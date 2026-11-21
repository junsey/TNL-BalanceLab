"use client";
import { useEffect, useMemo, useState } from "react";
import type {
  resolveAction,
  TacticalState,
} from "../../../packages/engine/src/index.ts";
import { selectEncounterFrame } from "../lib/encounter-frames";
type Event = ReturnType<typeof resolveAction>["event"];

/** Both screens consume recorded events; presentation never resolves actions or rolls dice. */
export function useCombatPresentation({
  initial,
  state,
  events,
  cursor,
  manual,
  enabled,
  animations,
  speed,
  autoContinue,
  playbackPaused,
  initiativeOpen,
  onReplayAdvance,
}: {
  initial?: TacticalState;
  state?: TacticalState;
  events: readonly Event[];
  cursor: number | null;
  manual: boolean;
  enabled: boolean;
  animations: boolean;
  speed: number;
  autoContinue: boolean;
  playbackPaused: boolean;
  initiativeOpen: boolean;
  onReplayAdvance: (cursor: number) => void;
}) {
  const [visual, setVisual] = useState<{
    event: Event;
    index: number;
    ready: boolean;
  } | null>(null);
  const latestEvent = cursor === null ? events.at(-1) : events[cursor - 1];
  const playback = visual?.event === latestEvent ? visual : null;
  const frameIndex = playback?.index ?? 0;
  const pendingManual = cursor === null && !!state?.pending && manual;
  const { frame, waiting } = selectEncounterFrame(
    enabled && !initiativeOpen ? (latestEvent?.details ?? []) : [],
    frameIndex,
    {
      instant: false,
      pending: cursor === null && !!state?.pending,
      manual: pendingManual,
    },
  );
  const ready = !animations || speed === 0 || playback?.ready === true;
  const hasNextFrame = !!selectEncounterFrame(
    latestEvent?.details ?? [],
    frameIndex + 1,
    { instant: false, pending: false, manual: false },
  ).frame;
  const visibleEvents = cursor === null ? events.length : cursor;
  const hold = !!frame && (!waiting || !ready);
  const delay = animations && speed ? 420 / speed : 0;
  useEffect(() => {
    if (
      !frame &&
      enabled &&
      autoContinue &&
      !playbackPaused &&
      !initiativeOpen &&
      cursor !== null &&
      cursor < events.length
    ) {
      const timer = window.setTimeout(
        () => onReplayAdvance(cursor + 1),
        Math.max(160, 420 / (speed || 1)),
      );
      return () => window.clearTimeout(timer);
    }
    if (
      !frame ||
      !latestEvent ||
      playbackPaused ||
      (ready && (waiting || (!hasNextFrame && !autoContinue)))
    )
      return;
    const timer = window.setTimeout(
      () =>
        setVisual({
          event: latestEvent,
          index: ready ? frameIndex + 1 : frameIndex,
          ready: !ready,
        }),
      ready ? Math.max(350, 640 / (speed || 1)) : delay,
    );
    return () => window.clearTimeout(timer);
  }, [
    frame,
    latestEvent,
    speed,
    waiting,
    ready,
    frameIndex,
    delay,
    autoContinue,
    hasNextFrame,
    playbackPaused,
    initiativeOpen,
    cursor,
    events.length,
    enabled,
    onReplayAdvance,
  ]);
  const attackEvent =
    frame?.kind === "DEFENSE"
      ? events.slice(0, visibleEvents).findLast((event) => {
          const details =
            event === latestEvent
              ? event.details.slice(0, event.details.indexOf(frame))
              : event.details;
          return details.some(
            (d) =>
              d.kind === "IMPACT" &&
              d.actor === frame.attacker &&
              d.targetActor === frame.actor,
          );
        })
      : undefined;
  const previousAttack = attackEvent?.details
    .slice(
      0,
      attackEvent === latestEvent && frame
        ? attackEvent.details.indexOf(frame)
        : undefined,
    )
    .findLast(
      (d) =>
        d.kind === "IMPACT" &&
        d.actor === frame?.attacker &&
        d.targetActor === frame?.actor,
    );
  const beforeFrame = useMemo(() => {
    if (!frame) return [];
    const actors = new Map(
      (initial?.actors ?? []).map((actor) => [actor.fighter.id, actor]),
    );
    for (const event of events.slice(
      0,
      attackEvent ? events.indexOf(attackEvent) : visibleEvents - 1,
    ))
      for (const actor of event.changes.actors)
        actors.set(actor.fighter.id, actor);
    return [...actors.values()];
  }, [frame, attackEvent, initial, events, visibleEvents]);
  const advance = () => {
    if (!latestEvent) return;
    if (
      ready &&
      !waiting &&
      cursor !== null &&
      cursor < events.length &&
      !hasNextFrame
    )
      onReplayAdvance(cursor + 1);
    setVisual({
      event: latestEvent,
      index: ready && !waiting ? frameIndex + 1 : frameIndex,
      ready: !ready || waiting,
    });
  };
  return {
    latestEvent,
    frameIndex,
    frame,
    waiting,
    ready,
    hasNextFrame,
    visibleEvents,
    hold,
    delay,
    pendingManual,
    previousAttack,
    beforeFrame,
    setVisual,
    advance,
  };
}
