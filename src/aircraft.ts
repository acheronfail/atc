import { Heading } from "./heading.ts";
import { GameMap } from "./types.ts";
import { random, randomIndex } from "./utils.ts";

interface AircraftBase {
  id: string;
  x: number;
  y: number;
  altitude: number;
  heading: Heading;
  destination: { type: "airport"; id: number } | { type: "exit"; id: number };
  command: {
    turn?: Heading;
    altitude?: number;
  };
}

interface PropAircraft extends AircraftBase {
  type: "prop";
}

interface JetAircraft extends AircraftBase {
  type: "jet";
}

export type Aircraft = PropAircraft | JetAircraft;

const alpha = new Set([..."abcdefghijklmnopqrstuvwxyz"]);

export function createAircraft(map: GameMap, aircrafts: Aircraft[]): Aircraft | null {
  const id = Array.from(alpha.difference(new Set(aircrafts.map((a) => a.id))))[0];
  const exit = random(
    map.info.exits.filter((exit) => {
      const hasAircraftClose = aircrafts.some((a) => Math.abs(a.x - exit[0]) < 3 && Math.abs(a.y - exit[1]) < 3);
      return !hasAircraftClose;
    }),
  );

  if (!id || !exit) return null;

  const [exitX, exitY, exitHeading] = exit;
  const aircraft: Aircraft = {
    id,
    type: random(["jet", "prop"]),
    heading: exitHeading,
    altitude: 7,
    destination: random([true, false])
      ? { type: "airport", id: randomIndex(map.info.airports) }
      : { type: "exit", id: random(map.info.exits.map((e, i) => ({ e, i })).filter(({ e }) => e !== exit)).i },
    x: exitX,
    y: exitY,
    command: {},
  };

  return aircraft;
}
