import { GameEvent, GameState } from "../types.ts";

export interface Renderer {
  draw(state: GameState): void;
  nextEvent(state: GameState): Promise<GameEvent>;
}

export interface UI {
  open(state: GameState): Renderer;
  close(error?: Error): void;
}
