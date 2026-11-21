"use client";
import { useEffect, type ComponentProps } from "react";
import type { TacticalState } from "../../../packages/engine/src/index.ts";
import { CombatDialog, InitiativeSequence } from "./combat-view";
import { EncounterWindow } from "./encounter-window";
import type { useCombatPresentation } from "./use-combat-presentation";

export function CombatInitiative({
  open,
  initial,
  name,
  replay,
  onClose,
  autoContinue = false,
  speed = 1,
}: {
  open: boolean;
  initial: TacticalState;
  name: (id: string) => string;
  replay: boolean;
  onClose: () => void;
  autoContinue?: boolean;
  speed?: number;
}) {
  useEffect(() => {
    if (!open || !autoContinue) return;
    const timer = window.setTimeout(
      onClose,
      Math.max(500, 1800 / (speed || 1)),
    );
    return () => window.clearTimeout(timer);
  }, [open, autoContinue, speed, onClose]);
  return open ? (
    <CombatDialog
      title="Iniciativa del encuentro"
      className="initiative-dialog"
      onClose={onClose}
    >
      <InitiativeSequence
        state={initial}
        name={name}
        replay={replay}
        onContinue={onClose}
      />
    </CombatDialog>
  ) : null;
}

type Controls = Pick<
  ComponentProps<typeof EncounterWindow>,
  | "state"
  | "name"
  | "onAction"
  | "paused"
  | "playbackPaused"
  | "onPause"
  | "autoContinue"
  | "onAutoContinue"
  | "onResume"
  | "speed"
  | "onSpeed"
>;
export function CombatExchange({
  presentation: p,
  animations,
  onAdvance,
  ...controls
}: Controls & {
  presentation: ReturnType<typeof useCombatPresentation>;
  animations: boolean;
  onAdvance: () => void;
}) {
  const { frame, latestEvent, frameIndex, previousAttack } = p;
  if (!frame || !latestEvent) return null;
  const declaration =
    frame.maneuver === "sweep" || previousAttack?.maneuver === "sweep"
      ? "Barrido"
      : latestEvent.details.some(
            (d) => d.kind === "OPPORTUNITY_DECISION" && d.accepted,
          )
        ? "Ataque de oportunidad"
        : latestEvent.details.some(
              (d) => d.kind === "PREPARATION_TRIGGERED" && d.executed,
            )
          ? "Ataque preparado"
          : undefined;
  return (
    <EncounterWindow
      {...controls}
      key={latestEvent.sequence + ":" + frameIndex}
      detail={frame}
      attack={previousAttack}
      effects={latestEvent.details.filter((d) =>
        [
          "CONDITION_TICK",
          "AGONY",
          "DODGE_MOVE",
          "PREPARATION_TRIGGERED",
          "PREPARED_RECOVERY",
        ].includes(d.kind),
      )}
      before={p.beforeFrame}
      ready={p.ready}
      canContinue={p.ready && !p.waiting && !p.hasNextFrame}
      waiting={p.waiting}
      manual={p.pendingManual}
      delay={p.delay}
      reduced={!animations || controls.speed === 0}
      declaration={declaration}
      onSkip={onAdvance}
    />
  );
}
