import * as assert from "node:assert";
import * as process from "node:process";
import EventEmitter from "node:events";
import { crayon } from "https://deno.land/x/crayon@3.3.3/mod.ts";
import { GameEvent, GameMap, GameState } from "../types.ts";
import { aircraftLabel } from "../utils.ts";
import { characterToHeading, headingNameMap } from "../heading.ts";
import { Renderer, UI } from "./index.ts";

export class TerminalUI implements UI {
  private renderer?: TerminalRenderer;

  open(state: GameState): TerminalRenderer {
    return (this.renderer = new TerminalRenderer(state));
  }

  close(error?: Error): void {
    if (this.renderer) {
      this.renderer?.close(error);
    } else {
      console.error(error);
    }
  }
}

export class TerminalRenderer implements Renderer {
  private readonly inputEvents: EventEmitter;
  private readonly state: GameState;

  constructor(state: GameState) {
    this.state = state;
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);

    this.inputEvents = new EventEmitter();
    process.stdin.on("data", (char: string) => {
      const sendInput = (input: GameEvent) => this.inputEvents.emit("input", input);

      const [aircraftId, cmd, cmdData] = this.state.command;
      switch (char) {
        case "\x03":
        case "\x04":
        case "\x1b":
          return sendInput({ type: "exit" });
        case "\r":
          return sendInput({ type: cmdData ? "send" : "tick" });
        case "\x7f":
          this.state.command.pop();
          return sendInput({ type: "draw" });
      }

      if (!aircraftId) {
        if (char.charCodeAt(0) >= 97 && char.charCodeAt(0) <= 122) {
          this.state.command = [char];
          return sendInput({ type: "draw" });
        }
      }

      if (aircraftId && !cmd) {
        switch (char) {
          case "t":
            this.state.command = [aircraftId, "turn"];
            break;
          case "a":
            this.state.command = [aircraftId, "altitude"];
            break;
        }

        return sendInput({ type: "draw" });
      }

      if (cmd && !cmdData) {
        if (cmd == "turn") {
          const heading = characterToHeading[char];
          if (heading !== undefined) {
            this.state.command = [this.state.command[0], "turn", {
              text: headingNameMap[heading],
              heading,
            }];
          }

          return sendInput({ type: "draw" });
        }

        if (cmd == "altitude") {
          switch (char) {
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9": {
              const altitude = parseInt(char);
              this.state.command = [
                this.state.command[0],
                "altitude",
                { text: (altitude * 1000).toString(), altitude },
              ];
            }
          }
          return sendInput({ type: "draw" });
        }
      }
    });
  }

  _clearStdout() {
    const { rows } = process.stdout;
    for (let y = 0; y < rows; y++) {
      process.stdout.cursorTo(0, y);
      process.stdout.clearLine(0);
    }
  }

  nextEvent(state: GameState): Promise<GameEvent> {
    const timeToNextTick = state.tickRate * 1000 -
      (Date.now() - state.lastTick);
    return Promise.race([
      new Promise<GameEvent>((resolve) => setTimeout(() => resolve({ type: "tick" }), timeToNextTick)),
      new Promise<GameEvent>((resolve) => this.inputEvents.once("input", resolve)),
    ]);
  }

  close(error?: Error): void {
    process.stdin.setRawMode(false);
    this._clearStdout();
    process.stdout.cursorTo(0, 0);

    if (error) {
      console.error(error);
    } else {
      console.log(`Game over! (${this.state.failure})`);
      console.log(`time: ${this.state.tick} safe: ${this.state.safe}`);
    }
  }

  draw(state: GameState) {
    const { rows, columns } = process.stdout;

    assert.ok(rows + 3 >= this.state.map.y, "terminal needs more rows");
    assert.ok(columns + 20 >= this.state.map.x, "terminal needs more columns");
    this._clearStdout();

    const xScale = 3;

    // map
    this.state.map.grid.forEach((row, y) => {
      if (y == 0 || y == this.state.map.y - 1) {
        process.stdout.cursorTo(0, y);
        process.stdout.write("-".repeat((this.state.map.x - 1) * xScale));
      }

      row.forEach((cell, j) => {
        const x = j * xScale;
        assert.ok(
          !("exit" in cell && "airport" in cell),
          "airport and exit cannot exist on the same cell",
        );

        if (cell.exit) {
          process.stdout.cursorTo(x, y);
          process.stdout.write(crayon.bold(`${cell.exit.id}`));
        } else if (cell.airport) {
          process.stdout.cursorTo(x - 1, y);
          process.stdout.write(
            crayon.bold(`${cell.airport.direction}${cell.airport.id}`),
          );
        } else if (cell.beacon) {
          process.stdout.cursorTo(x - 1, y);
          process.stdout.write(crayon.bold(`*${cell.beacon.id}`));
        } else if (cell.path) {
          process.stdout.cursorTo(x, y);
          process.stdout.write(crayon.bold("+"));
        } else {
          process.stdout.cursorTo(x, y);
          process.stdout.write(this.getBaseMapChar(this.state.map, j, y));
        }
      });
    });

    this.state.aircrafts.forEach((aircraft) => {
      const { x, y } = aircraft;
      process.stdout.cursorTo(x * xScale - 1, y);
      process.stdout.write(crayon.bgWhite.black(aircraftLabel(aircraft)));
    });

    // sidebar
    const barX = this.state.map.x * xScale;
    process.stdout.cursorTo(barX, 0);
    process.stdout.write(`time: ${state.tick} safe: ${state.safe}`);

    process.stdout.cursorTo(barX, 2);
    process.stdout.write("pl dt comm");

    this.state.aircrafts.forEach((aircraft, i) => {
      process.stdout.cursorTo(barX, i + 3);
      const label = aircraft.destination.type === "airport"
        ? `A${aircraft.destination.id}`
        : `E${aircraft.destination.id}`;
      process.stdout.write(`${aircraftLabel(aircraft)} ${label}`);

      if (aircraft.command.altitude !== undefined) {
        process.stdout.write(` alt -> ${aircraft.command.altitude}`);
      }

      if (aircraft.command.turn !== undefined) {
        process.stdout.write(
          ` dir -> ${headingNameMap[aircraft.command.turn]}`,
        );
      }
    });

    // input
    process.stdout.cursorTo(0, this.state.map.y + 1);
    process.stdout.write("> ");
    const [aircraftId, cmd, cmdData] = this.state.command;
    if (aircraftId) {
      const aircraft = this.state.aircrafts.find((a) => a.id === aircraftId);
      process.stdout.write(
        `${crayon[aircraft ? "green" : "red"](aircraftId)}: `,
      );
    }
    if (cmd) {
      process.stdout.write(`${cmd}: `);
    }
    if (cmdData) {
      process.stdout.write(cmdData.text);
    }

    if (state.failure) {
      process.stdout.cursorTo(0, this.state.map.y + 1);
      process.stdout.clearLine(0);
      process.stdout.write(crayon.red(state.failure));
    }
  }

  getBaseMapChar(grid: GameMap, x: number, y: number) {
    if (y == 0 || y == grid.y - 1) return "-";
    if (x == 0 || x == grid.x - 1) return "|";
    return ".";
  }
}
