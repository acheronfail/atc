import * as assert from "node:assert";
import { GameMap, GameState } from "./types.ts";
import { headingMatchesDirection } from "./heading.ts";
import { Aircraft } from "./aircraft.ts";
import { UI } from "./ui/index.ts";

export class Game {
  private readonly ui: UI;
  private readonly state: GameState;
  private readonly map: GameMap;

  constructor(map: GameMap, ui: UI) {
    this.state = {
      tick: 0,
      safe: 0,
      command: {},
      lastTick: Date.now(),
      tickRate: map.info.tickRate,
      map,
      aircrafts: [],
    };
    this.map = map;
    this.ui = ui;
  }

  async run() {
    const renderer = this.ui.open(this.state);

    loop: for (;;) {
      renderer.draw(this.state);
      const event = await renderer.nextEvent(this.state);

      if (this.state.failure) {
        break loop;
      }

      switch (event.type) {
        case "draw":
          continue loop;
        case "exit":
          this.state.failure = "exited";
          break loop;
        case "tick":
          break;
        case "send": {
          const { aircraftId, altitude, turn } = this.state.command;
          this.state.command = {};

          assert.ok(
            aircraftId && (altitude !== undefined || turn?.heading !== undefined),
            "unexpected partial game command",
          );

          const aircraft = this.state.aircrafts.find((a) => a.id === aircraftId);
          if (!aircraft) break;

          if (altitude?.value !== undefined) {
            aircraft.command.altitude = altitude.value;
          }
          if (turn?.heading !== undefined) {
            aircraft.command.turn = { heading: turn.heading, beacon: turn.beacon };
          }

          continue loop;
        }
        default:
          throw new Error(`Unrecognised input: ${JSON.stringify(event)}`);
      }

      this.state.aircrafts.forEach((aircraft) => aircraft.performCommand(this.state.tick, this.state.map));
      if (!this.moveAircraftsAndCheckCollisions()) continue loop;
      this.spawnAircrafts();

      this.state.tick++;
      this.state.lastTick = Date.now();
    }
  }

  spawnAircrafts() {
    if (this.state.tick === 0) {
      const aircraft = Aircraft.create(this.map, this.state.aircrafts);
      if (aircraft) this.state.aircrafts.push(aircraft);
    } else if (this.state.tick % Math.max(1, this.map.info.spawnRate - Math.floor(this.state.safe / 5)) === 0) {
      const aircraft = Aircraft.create(this.map, this.state.aircrafts);
      if (aircraft) this.state.aircrafts.push(aircraft);
    }
  }

  moveAircraftsAndCheckCollisions(): boolean {
    for (let i = this.state.aircrafts.length - 1; i >= 0; --i) {
      const aircraft = this.state.aircrafts[i];
      if (!aircraft.shouldUpdate(this.state.tick)) {
        continue;
      }

      aircraft.move();

      const cell = this.map.grid[aircraft.y][aircraft.x];

      // edge conditions
      if (aircraft.x == 0 || aircraft.y == 0 || aircraft.x == this.map.x - 1 || aircraft.y == this.map.y - 1) {
        if (cell.exit) {
          if (aircraft.destination.id === cell.exit.id) {
            if (aircraft.altitude != 9) {
              this.state.failure = `${aircraft.label()} exited at ${aircraft.altitude * 1000}ft rather than 9000ft`;
              return false;
            }

            this.state.aircrafts.splice(i, 1);
            this.state.safe++;
            break;
          }
          this.state.failure = `${aircraft.label()} exited at E${cell.exit.id} instead of E${aircraft.destination.id}`;
          return false;
        }

        this.state.failure = `${aircraft.label()} exited at the wrong location`;
        return false;
      }

      // airport conditions
      if (aircraft.altitude === 0) {
        if (!cell.airport) {
          this.state.failure = `${aircraft.label()} crashed into the ground`;
          return false;
        }

        if (!headingMatchesDirection(aircraft.heading, cell.airport.direction)) {
          this.state.failure = `${aircraft.label()} crashed into airport (wrong direction)`;
          return false;
        }

        if (aircraft.destination.id !== cell.airport.id) {
          this.state.failure = `${aircraft.label()} landed at the wrong airport`;
          return false;
        }

        this.state.aircrafts.splice(i, 1);
        this.state.safe++;
        break;
      }

      // crash conditions
      for (let j = this.state.aircrafts.length - 1; j >= 0; --j) {
        if (i == j) continue;
        const other = this.state.aircrafts[j];
        const tooClose = Math.abs(aircraft.altitude - other.altitude) < 2;
        if (aircraft.x === other.x && aircraft.y === other.y && tooClose) {
          this.state.failure = `${aircraft.label()} collided with ${other.label()}`;
          return false;
        }
      }
    }

    return true;
  }
}
