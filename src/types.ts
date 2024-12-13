import { Aircraft } from "./aircraft.ts";
import { Direction, Heading } from "./heading.ts";

export type GameEvent =
  | { type: "tick" }
  | { type: "exit" }
  | { type: "send" }
  | { type: "draw" };

type Command =
  | []
  | [string /* aircraft id */]
  | [string, /* aircraft id */ "turn"]
  | [string, /* aircraft id */ "turn", { heading: Heading; text: string }]
  | [string, /* aircraft id */ "altitude"]
  | [string, /* aircraft id */ "altitude", { altitude: number; text: string }];

export interface GameState {
  failure?: string;
  tick: number;
  safe: number;
  command: Command;
  lastTick: number;
  tickRate: number;
  map: GameMap;
  aircrafts: Aircraft[];
}

export interface Item {
  exit?: { id: number };
  path?: boolean;
  beacon?: { id: number };
  airport?: { id: number; direction: Direction };
}

export interface GameMap {
  x: number;
  y: number;
  info: MapInfo;
  grid: Array<Array<Item>>;
}

export interface MapInfo {
  width: number;
  height: number;
  tickRate: number;
  spawnRate: number;
  exits: [number, number, Heading][];
  airports: [number, number, Direction][];
  paths: [[number, number], [number, number]][];
  beacons: [number, number][];
}
