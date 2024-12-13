import * as assert from "node:assert";
import { GameMap, GameState } from "./types.ts";
import { aircraftLabel } from "./utils.ts";
import { Heading, headingCount, headingMatchesDirection } from "./heading.ts";
import { Aircraft, createAircraft } from "./aircraft.ts";
import { UI } from "./ui/index.ts";

export class Game {
  private readonly ui: UI;
  private readonly state: GameState;
  private readonly map: GameMap;

  constructor(map: GameMap, ui: UI) {
    this.state = {
      tick: 0,
      safe: 0,
      command: [],
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
          const [aircraftId, cmd, cmdData] = this.state.command;
          this.state.command = [];
          assert.ok(cmd && cmdData, "unexpected partial game command");

          const aircraft = this.state.aircrafts.find((a) =>
            a.id === aircraftId
          );
          if (!aircraft) break;

          switch (cmd) {
            case "altitude":
              aircraft.command.altitude = cmdData.altitude;
              break;
            case "turn":
              aircraft.command.turn = cmdData.heading;
              break;
          }

          continue loop;
        }
        default:
          throw new Error(`Unrecognised input: ${JSON.stringify(event)}`);
      }

      this.performAircraftCommands();
      if (!this.updateAircraftPositions()) continue loop;
      this.spawnAircrafts();

      this.state.tick++;
      this.state.lastTick = Date.now();
    }
  }

  moveAircraft(aircraft: Aircraft) {
    switch (aircraft.heading) {
      case Heading.North:
        aircraft.y--;
        break;
      case Heading.NorthEast:
        aircraft.x++;
        aircraft.y--;
        break;
      case Heading.East:
        aircraft.x++;
        break;
      case Heading.SouthEast:
        aircraft.x++;
        aircraft.y++;
        break;
      case Heading.South:
        aircraft.y++;
        break;
      case Heading.SouthWest:
        aircraft.x--;
        aircraft.y++;
        break;
      case Heading.West:
        aircraft.x--;
        break;
      case Heading.NorthWest:
        aircraft.x--;
        aircraft.y--;
        break;
    }
  }

  spawnAircrafts() {
    if (this.state.tick === 0) {
      const aircraft = createAircraft(this.map, this.state.aircrafts);
      if (aircraft) this.state.aircrafts.push(aircraft);
    } else if (
      this.state.tick %
          Math.max(
            1,
            this.map.info.spawnRate - Math.floor(this.state.safe / 5),
          ) === 0
    ) {
      const aircraft = createAircraft(this.map, this.state.aircrafts);
      if (aircraft) this.state.aircrafts.push(aircraft);
    }
  }

  performAircraftCommands() {
    this.state.aircrafts.forEach((aircraft) => {
      const { command } = aircraft;

      if (command.altitude !== undefined) {
        if (command.altitude < aircraft.altitude) {
          aircraft.altitude--;
        } else if (command.altitude > aircraft.altitude) {
          aircraft.altitude++;
        }

        if (command.altitude === aircraft.altitude) {
          delete aircraft.command.altitude;
        }
      }

      // NOTE: if planes are near the wall, and you ask them to do a 180 degree turn, they can
      // turn straight into the wall and crash; this happens in the original `atc`, too
      if (command.turn !== undefined) {
        const cwTurns = (command.turn - aircraft.heading + headingCount) %
          headingCount;
        const ccwTurns = (aircraft.heading - command.turn + headingCount) %
          headingCount;

        aircraft.heading += ccwTurns < cwTurns
          ? Math.max(-2, -ccwTurns)
          : Math.min(2, cwTurns);

        if (aircraft.heading === command.turn) {
          delete aircraft.command.turn;
        }
      }
    });
  }

  updateAircraftPositions(): boolean {
    for (let i = this.state.aircrafts.length - 1; i >= 0; --i) {
      const aircraft = this.state.aircrafts[i];
      if (this.state.tick % 2 == 0 && aircraft.type === "prop") {
        continue;
      }

      this.moveAircraft(aircraft);

      const cell = this.map.grid[aircraft.y][aircraft.x];

      // edge conditions
      if (
        aircraft.x == 0 || aircraft.y == 0 || aircraft.x == this.map.x - 1 ||
        aircraft.y == this.map.y - 1
      ) {
        if (cell.exit) {
          if (aircraft.destination.id === cell.exit.id) {
            if (aircraft.altitude != 9) {
              this.state.failure = `${aircraftLabel(aircraft)} exited at ${
                aircraft.altitude * 1000
              }ft rather than 9000ft`;
              return false;
            }

            this.state.aircrafts.splice(i, 1);
            this.state.safe++;
            break;
          }
          this.state.failure = `${
            aircraftLabel(aircraft)
          } exited at E${cell.exit.id} instead of E${aircraft.destination.id}`;
          return false;
        }

        this.state.failure = `${
          aircraftLabel(aircraft)
        } exited at the wrong location`;
        return false;
      }

      // airport conditions
      if (aircraft.altitude === 0) {
        if (!cell.airport) {
          this.state.failure = `${
            aircraftLabel(aircraft)
          } crashed into the ground`;
          return false;
        }

        if (
          !headingMatchesDirection(aircraft.heading, cell.airport.direction)
        ) {
          this.state.failure = `${
            aircraftLabel(aircraft)
          } crashed into airport (wrong direction)`;
          return false;
        }

        if (aircraft.destination.id !== cell.airport.id) {
          this.state.failure = `${
            aircraftLabel(aircraft)
          } landed at the wrong airport`;
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
        const tooClose = Math.abs(aircraft.altitude - other.altitude) <= 3;
        if (aircraft.x === other.x && aircraft.y === other.y && tooClose) {
          this.state.failure = `${aircraftLabel(aircraft)} collided with ${
            aircraftLabel(other)
          }`;
          return false;
        }
      }
    }

    return true;
  }
}
