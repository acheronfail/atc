import { Heading, HEADING_COUNT } from "./heading.ts";
import { GameMap } from "./types.ts";
import { random, randomIndex } from "./utils.ts";

const ALPHABET = new Set([..."abcdefghijklmnopqrstuvwxyz"]);

export abstract class Aircraft {
  constructor(
    public readonly id: string,
    public x: number,
    public y: number,
    public altitude: number,
    public heading: Heading,
    public readonly destination: { type: "airport"; id: number } | { type: "exit"; id: number },
    public command: { turn?: Heading; altitude?: number },
  ) {
  }

  abstract label(): string;
  abstract shouldUpdate(tick: number): boolean;

  public static create(
    map: GameMap,
    aircrafts: Aircraft[],
    ctor?: new (...args: ConstructorParameters<typeof Aircraft>) => Aircraft,
  ): Aircraft | null {
    const id = Array.from(ALPHABET.difference(new Set(aircrafts.map((a) => a.id))))[0];
    const exit = random(
      map.info.exits.filter((exit) => {
        const hasAircraftClose = aircrafts.some((a) => Math.abs(a.x - exit[0]) < 3 && Math.abs(a.y - exit[1]) < 3);
        return !hasAircraftClose;
      }),
    );

    if (!id || !exit) return null;

    const [exitX, exitY, exitHeading] = exit;
    return new (ctor ? ctor : random([Jet, Prop]))(
      id,
      exitX,
      exitY,
      7,
      exitHeading,
      random([true, false])
        ? { type: "airport", id: randomIndex(map.info.airports) }
        : { type: "exit", id: random(map.info.exits.map((e, i) => ({ e, i })).filter(({ e }) => e !== exit)).i },
      {},
    );
  }

  public move() {
    switch (this.heading) {
      case Heading.North:
        this.y--;
        break;
      case Heading.NorthEast:
        this.x++;
        this.y--;
        break;
      case Heading.East:
        this.x++;
        break;
      case Heading.SouthEast:
        this.x++;
        this.y++;
        break;
      case Heading.South:
        this.y++;
        break;
      case Heading.SouthWest:
        this.x--;
        this.y++;
        break;
      case Heading.West:
        this.x--;
        break;
      case Heading.NorthWest:
        this.x--;
        this.y--;
        break;
    }
  }

  public performCommand(tick: number) {
    if (!this.shouldUpdate(tick)) {
      return;
    }

    const { command } = this;

    if (command.altitude !== undefined) {
      if (command.altitude < this.altitude) {
        this.altitude--;
      } else if (command.altitude > this.altitude) {
        this.altitude++;
      }

      if (command.altitude === this.altitude) {
        delete this.command.altitude;
      }
    }

    // NOTE: if planes are near the wall, and you ask them to do a 180 degree turn, they can
    // turn straight into the wall and crash; this happens in the original `atc`, too
    if (command.turn !== undefined) {
      // FIXME: there is a bug here, where the plane can get stuck and not turn
      const cwTurns = (command.turn - this.heading + HEADING_COUNT) % HEADING_COUNT;
      const ccwTurns = (this.heading - command.turn + HEADING_COUNT) % HEADING_COUNT;

      const nextHeading = this.heading + (ccwTurns < cwTurns ? Math.max(-2, -ccwTurns) : Math.min(2, cwTurns));
      this.heading = (nextHeading + HEADING_COUNT) % HEADING_COUNT;

      if (this.heading === command.turn) {
        delete this.command.turn;
      }
    }
  }
}

class Jet extends Aircraft {
  label(): string {
    return this.id.toLowerCase() + this.altitude;
  }

  shouldUpdate(_: number): boolean {
    return true;
  }
}

class Prop extends Aircraft {
  label(): string {
    return this.id.toUpperCase() + this.altitude;
  }

  shouldUpdate(tick: number): boolean {
    return tick % 2 === 0;
  }
}
