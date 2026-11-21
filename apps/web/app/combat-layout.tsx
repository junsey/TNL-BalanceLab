"use client";
import type { ComponentProps } from "react";
import type { TacticalState } from "../../../packages/engine/src/index.ts";
import { TacticalBoard, CommandMenu, EnemyPanel } from "./combat-view";
import { PartyBar } from "./party-bar";
import { LatestResolution } from "./combat-log";

export function CombatLayout({
  state,
  name,
  active,
  paused,
  onActor,
  onSheet,
  commands,
  board,
  enemies,
  events,
  cursor,
}: {
  state: TacticalState;
  name: (id: string) => string;
  active: string;
  paused: boolean;
  onActor: (id: string) => void;
  onSheet: (id: string) => void;
  commands: Omit<ComponentProps<typeof CommandMenu>, "state">;
  board: Omit<ComponentProps<typeof TacticalBoard>, "state" | "name">;
  enemies: Omit<
    ComponentProps<typeof EnemyPanel>,
    "state" | "name" | "active" | "onSelect"
  >;
  events: ComponentProps<typeof LatestResolution>["events"];
  cursor: number | null;
}) {
  const ids = state.setup.playerTeam ?? [state.setup.player];
  const actors = ids.flatMap((id) =>
    state.actors.filter((a) => a.fighter.id === id),
  );
  return (
    <div className="combat-layout">
      <PartyBar
        actors={actors}
        state={state}
        name={name}
        onSheet={onSheet}
        onSelect={onActor}
        selected={active}
        paused={paused}
      >
        <CommandMenu
          key={active + ":" + state.sequence}
          {...commands}
          state={state}
        />
      </PartyBar>
      <div className="combat-center">
        <TacticalBoard {...board} state={state} name={name} />
        <LatestResolution events={events} cursor={cursor} name={name} />
      </div>
      <EnemyPanel
        {...enemies}
        state={state}
        name={name}
        active={active}
        onSelect={onActor}
      />
    </div>
  );
}
