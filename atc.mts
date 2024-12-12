import * as fs from 'node:fs';
import * as process from 'node:process';
import * as assert from 'node:assert';
import { crayon } from 'https://deno.land/x/crayon@3.3.3/mod.ts';
import EventEmitter from 'node:events';

enum Direction {
  Up = '^',
  Down = 'v',
  Left = '<',
  Right = '>',
}

enum Heading {
  North,
  NorthEast,
  East,
  SouthEast,
  South,
  SouthWest,
  West,
  NorthWest,
}
const headingCount = Object.values(Heading).length;

const headingToCharacter: Record<Heading, string> = {
  [Heading.North]: 'w',
  [Heading.NorthEast]: 'e',
  [Heading.East]: 'd',
  [Heading.SouthEast]: 'c',
  [Heading.South]: 'x',
  [Heading.SouthWest]: 'z',
  [Heading.West]: 'a',
  [Heading.NorthWest]: 'q',
};

const characterToHeading: Record<string, Heading> = Object.fromEntries(
  Object.entries(headingToCharacter).map(([a, b]) => [b, parseInt(a)])
);

const headingNameMap: Record<Heading, string> = {
  [Heading.North]: 'North',
  [Heading.NorthEast]: 'NorthEast',
  [Heading.East]: 'East',
  [Heading.SouthEast]: 'SouthEast',
  [Heading.South]: 'South',
  [Heading.SouthWest]: 'SouthWest',
  [Heading.West]: 'West',
  [Heading.NorthWest]: 'NorthWest',
};

interface AircraftBase {
  id: string;
  x: number;
  y: number;
  altitude: number;
  heading: Heading;
  destination: { type: 'airport'; id: number } | { type: 'exit'; id: number };
  command: {
    turn?: Heading;
    altitude?: number;
  };
}

interface PropAircraft extends AircraftBase {
  type: 'prop';
}

interface JetAircraft extends AircraftBase {
  type: 'jet';
}

type Aircraft = PropAircraft | JetAircraft;

type Event = { type: 'tick' } | { type: 'exit' } | { type: 'send' } | { type: 'draw' };

type Command =
  | []
  | [string /* aircraft id */]
  | [string /* aircraft id */, 'turn']
  | [string /* aircraft id */, 'turn', { heading: Heading; text: string }]
  | [string /* aircraft id */, 'altitude']
  | [string /* aircraft id */, 'altitude', { altitude: number; text: string }];

interface GameState {
  failure?: string;
  tick: number;
  safe: number;
  command: Command;
  lastTick: number;
  tickRate: number;
}

class Terminal {
  private readonly inputEvents: EventEmitter;
  private readonly state: GameState;

  constructor(state: GameState) {
    this.state = state;
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);

    this.inputEvents = new EventEmitter();
    process.stdin.on('data', (char: string) => {
      const sendInput = (input: Event) => this.inputEvents.emit('input', input);

      const [aircraftId, cmd, cmdData] = this.state.command;
      switch (char) {
        case '\x03':
        case '\x04':
        case '\x1b':
          return sendInput({ type: 'exit' });
        case '\r':
          return sendInput({ type: cmdData ? 'send' : 'tick' });
        case '\x7f':
          this.state.command.pop();
          return sendInput({ type: 'draw' });
      }

      if (!aircraftId) {
        if (char.charCodeAt(0) >= 97 && char.charCodeAt(0) <= 122) {
          this.state.command = [char];
          return sendInput({ type: 'draw' });
        }
      }

      if (aircraftId && !cmd) {
        switch (char) {
          case 't':
            this.state.command = [aircraftId, 'turn'];
            break;
          case 'a':
            this.state.command = [aircraftId, 'altitude'];
            break;
        }

        return sendInput({ type: 'draw' });
      }

      if (cmd && !cmdData) {
        if (cmd == 'turn') {
          const heading = characterToHeading[char];
          if (heading) {
            this.state.command = [this.state.command[0], 'turn', { text: headingNameMap[heading], heading }];
          }

          return sendInput({ type: 'draw' });
        }

        if (cmd == 'altitude') {
          switch (char) {
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9': {
              const altitude = parseInt(char);
              this.state.command = [
                this.state.command[0],
                'altitude',
                { text: (altitude * 1000).toString(), altitude },
              ];
            }
          }
          return sendInput({ type: 'draw' });
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

  nextEvent(): Promise<Event> {
    const timeToNextTick = this.state.tickRate * 1000 - (Date.now() - this.state.lastTick);
    return Promise.race([
      new Promise<Event>((resolve) => setTimeout(() => resolve({ type: 'tick' }), timeToNextTick)),
      new Promise<Event>((resolve) => this.inputEvents.once('input', resolve)),
    ]);
  }

  close() {
    process.stdin.setRawMode(false);
    this._clearStdout();
    process.stdout.cursorTo(0, 0);
  }

  draw(grid: GameMap, aircrafts: Aircraft[]) {
    const { rows, columns } = process.stdout;

    assert.ok(rows + 3 >= grid.y, 'terminal needs more rows');
    assert.ok(columns + 20 >= grid.x, 'terminal needs more columns');
    this._clearStdout();

    const xScale = 3;

    // map
    grid.grid.forEach((row, y) => {
      if (y == 0 || y == grid.y - 1) {
        process.stdout.cursorTo(0, y);
        process.stdout.write('-'.repeat((grid.x - 1) * xScale));
      }

      row.forEach((cell, j) => {
        const x = j * xScale;
        assert.ok(!('exit' in cell && 'airport' in cell), 'airport and exit cannot exist on the same cell');

        if (cell.exit) {
          process.stdout.cursorTo(x, y);
          process.stdout.write(crayon.bold(`${cell.exit.id}`));
        } else if (cell.airport) {
          process.stdout.cursorTo(x - 1, y);
          process.stdout.write(crayon.bold(`${cell.airport.direction}${cell.airport.id}`));
        } else if (cell.beacon) {
          process.stdout.cursorTo(x - 1, y);
          process.stdout.write(crayon.bold(`*${cell.beacon.id}`));
        } else if (cell.path) {
          process.stdout.cursorTo(x, y);
          process.stdout.write(crayon.bold('+'));
        } else {
          process.stdout.cursorTo(x, y);
          process.stdout.write(getBaseMapChar(grid, j, y));
        }
      });
    });

    aircrafts.forEach((aircraft) => {
      const { x, y } = aircraft;
      process.stdout.cursorTo(x * xScale - 1, y);
      process.stdout.write(crayon.bgWhite.black(aircraftLabel(aircraft)));
    });

    // sidebar
    const barX = grid.x * xScale;
    process.stdout.cursorTo(barX, 0);
    process.stdout.write(`time: ${this.state.tick} safe: ${this.state.safe}`);

    process.stdout.cursorTo(barX, 2);
    process.stdout.write('pl dt comm');

    aircrafts.forEach((aircraft, i) => {
      process.stdout.cursorTo(barX, i + 3);
      const label =
        aircraft.destination.type === 'airport' ? `A${aircraft.destination.id}` : `E${aircraft.destination.id}`;
      process.stdout.write(`${aircraftLabel(aircraft)} ${label}`);

      if (aircraft.command.altitude) {
        process.stdout.write(` alt -> ${aircraft.command.altitude}`);
      }

      if (aircraft.command.turn) {
        process.stdout.write(` dir -> ${headingNameMap[aircraft.command.turn]}`);
      }
    });

    // input
    process.stdout.cursorTo(0, grid.y + 1);
    process.stdout.write('> ');
    const [aircraftId, cmd, cmdData] = this.state.command;
    if (aircraftId) {
      const aircraft = aircrafts.find((a) => a.id === aircraftId);
      process.stdout.write(`${crayon[aircraft ? 'green' : 'red'](aircraftId)}: `);
    }
    if (cmd) {
      process.stdout.write(`${cmd}: `);
    }
    if (cmdData) {
      process.stdout.write(cmdData.text);
    }

    if (this.state.failure) {
      process.stdout.cursorTo(0, grid.y + 1);
      process.stdout.clearLine(0);
      process.stdout.write(crayon.red(this.state.failure));
    }
  }
}

//
// utils
//

function getBaseMapChar(grid: GameMap, x: number, y: number) {
  if (y == 0 || y == grid.y - 1) return '-';
  if (x == 0 || x == grid.x - 1) return '|';
  return '.';
}

function aircraftLabel({ type, id, altitude }: Aircraft) {
  const label = type === 'prop' ? id.toUpperCase() : id.toLowerCase();
  return `${label}${altitude}`;
}

function headingMatchesDirection(heading: Heading, direction: Direction): boolean {
  switch (direction) {
    case Direction.Down:
      return heading === Heading.South;
    case Direction.Up:
      return heading === Heading.North;
    case Direction.Left:
      return heading === Heading.West;
    case Direction.Right:
      return heading === Heading.East;
  }
}

function randomIndex(arr: unknown[]): number {
  return Math.floor(Math.random() * arr.length);
}

function random<T>(arr: []): null;
function random<T>(arr: T[] | []): T;
function random<T>(arr: T[] | []): T | null {
  if (arr.length === 0) return null;
  const i = randomIndex(arr);
  return arr[i];
}

interface Item {
  exit?: { id: number };
  path?: boolean;
  beacon?: { id: number };
  airport?: { id: number; direction: Direction };
}

interface GameMap {
  x: number;
  y: number;
  info: MapInfo;
  grid: Array<Array<Item>>;
}

interface MapInfo {
  tickRate: number;
  spawnRate: number;
  exits: [number, number, Heading][];
  airports: [number, number, Direction][];
  paths: [[number, number], [number, number]][];
  beacons: [number, number][];
}

const alpha = new Set([...'abcdefghijklmnopqrstuvwxyz']);
function createAircraft(map: GameMap, aircrafts: Aircraft[]): Aircraft | null {
  const id = Array.from(alpha.difference(new Set(aircrafts.map((a) => a.id))))[0];
  const exit = random(
    map.info.exits.filter((exit) => !aircrafts.some((a) => Math.abs(a.x - exit[0]) < 3 && Math.abs(a.y - exit[1]) < 3))
  );

  if (!id || !exit) return null;

  const [exitX, exitY, exitHeading] = exit;
  const aircraft: Aircraft = {
    id,
    type: random(['jet', 'prop']),
    heading: exitHeading,
    altitude: 7,
    destination: random([true, false])
      ? { type: 'airport', id: randomIndex(map.info.airports) }
      : { type: 'exit', id: randomIndex(map.info.exits) },
    x: exitX,
    y: exitY,
    command: {},
  };

  return aircraft;
}

function createMap(x: number, y: number, info: MapInfo) {
  const map: GameMap = { x, y, grid: [], info };
  for (let i = 0; i < y; ++i) {
    const row: Item[] = [];
    for (let j = 0; j < x; ++j) {
      row[j] = {};
    }

    map.grid.push(row);
  }

  for (const [[x1, y1], [x2, y2]] of info.paths) {
    let [x, y] = [x1, y1];
    for (;;) {
      assert.ok(x < map.x && y < map.y, `[${x}, ${y}] out of bounds of Map[${map.x}, ${map.y}]`);

      map.grid[y][x].path = true;
      if (x == x2 && y == y2) break;
      if (x < x2) x++;
      if (x > x2) x--;
      if (y < y2) y++;
      if (y > y2) y--;
    }
  }

  for (const [id, [x, y]] of Object.entries(info.exits)) {
    map.grid[y][x].exit = { id: +id };
  }

  for (const [id, [x, y, direction]] of Object.entries(info.airports)) {
    map.grid[y][x].airport = { id: +id, direction };
  }

  for (const [id, [x, y]] of Object.entries(info.beacons)) {
    map.grid[y][x].beacon = { id: +id };
  }

  return map;
}

function move(x: number, y: number, heading: Heading): [number, number] {
  switch (heading) {
    case Heading.North:
      return [x, --y];
    case Heading.NorthEast:
      return [++x, --y];
    case Heading.East:
      return [++x, y];
    case Heading.SouthEast:
      return [++x, ++y];
    case Heading.South:
      return [x, ++y];
    case Heading.SouthWest:
      return [--x, ++y];
    case Heading.West:
      return [--x, y];
    case Heading.NorthWest:
      return [--x, --y];
  }
}

//
// game
//

class Game {
  // TODO: re-factor so ui can be swapped out
  private readonly ui: Terminal;
  private readonly state: GameState;
  private readonly map: GameMap;
  private readonly aircrafts: Aircraft[];

  constructor(map: GameMap) {
    this.state = { tick: 0, safe: 0, command: [], lastTick: Date.now(), tickRate: map.info.tickRate };
    this.aircrafts = [];
    this.map = map;
    this.ui = new Terminal(this.state);
  }

  async run() {
    try {
      loop: for (;;) {
        this.ui.draw(this.map, this.aircrafts);
        const event = await this.ui.nextEvent();

        if (this.state.failure) {
          break loop;
        }

        switch (event.type) {
          case 'draw':
            continue loop;
          case 'exit':
            this.state.failure = 'exited';
            break loop;
          case 'tick':
            break;
          case 'send': {
            const [aircraftId, cmd, cmdData] = this.state.command;
            this.state.command = [];
            assert.ok(cmd && cmdData, 'unexpected partial game command');

            const aircraft = this.aircrafts.find((a) => a.id === aircraftId);
            if (!aircraft) break;

            switch (cmd) {
              case 'altitude':
                aircraft.command.altitude = cmdData.altitude;
                break;
              case 'turn':
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
    } catch (err) {
      this.ui.close();
      console.error(err);
      process.exit(1);
    } finally {
      this.ui.close();
      console.log(`Game over! (${this.state.failure})`);
      console.log(`time: ${this.state.tick} safe: ${this.state.safe}`);
      process.exit(0);
    }
  }

  spawnAircrafts() {
    if (this.state.tick === 0) {
      const aircraft = createAircraft(this.map, this.aircrafts);
      if (aircraft) this.aircrafts.push(aircraft);
    } else if (this.state.tick % Math.max(1, this.map.info.spawnRate - Math.floor(this.state.safe / 5)) === 0) {
      const aircraft = createAircraft(this.map, this.aircrafts);
      if (aircraft) this.aircrafts.push(aircraft);
    }
  }

  performAircraftCommands() {
    this.aircrafts.forEach((aircraft) => {
      const { command } = aircraft;

      if (command.altitude) {
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
      if (command.turn) {
        const cwTurns = (command.turn - aircraft.heading + headingCount) % headingCount;
        const ccwTurns = (aircraft.heading - command.turn + headingCount) % headingCount;

        aircraft.heading += ccwTurns < cwTurns ? Math.max(-2, -ccwTurns) : Math.min(2, cwTurns);

        if (aircraft.heading === command.turn) {
          delete aircraft.command.turn;
        }
      }
    });
  }

  updateAircraftPositions(): boolean {
    for (let i = this.aircrafts.length - 1; i >= 0; --i) {
      const aircraft = this.aircrafts[i];
      if (this.state.tick % 2 == 0 && aircraft.type === 'prop') {
        continue;
      }

      const [newX, newY] = move(aircraft.x, aircraft.y, aircraft.heading);
      aircraft.x = newX;
      aircraft.y = newY;

      const cell = this.map.grid[aircraft.y][aircraft.x];

      // edge conditions
      if (aircraft.x == 0 || aircraft.y == 0 || aircraft.x == this.map.x - 1 || aircraft.y == this.map.y - 1) {
        if (cell.exit) {
          if (aircraft.destination.id === cell.exit.id) {
            if (aircraft.altitude != 9) {
              this.state.failure = `${aircraftLabel(aircraft)} exited at ${
                aircraft.altitude * 1000
              }ft rather than 9000ft`;
              return false;
            }

            this.aircrafts.splice(i, 1);
            this.state.safe++;
            break;
          }
          this.state.failure = `${aircraftLabel(aircraft)} exited at E${cell.exit.id} instead of E${
            aircraft.destination.id
          }`;
          return false;
        }

        this.state.failure = `${aircraftLabel(aircraft)} exited at the wrong location`;
        return false;
      }

      // airport conditions
      if (aircraft.altitude === 0) {
        if (!cell.airport) {
          this.state.failure = `${aircraftLabel(aircraft)} crashed into the ground`;
          return false;
        }

        if (!headingMatchesDirection(aircraft.heading, cell.airport.direction)) {
          this.state.failure = `${aircraftLabel(aircraft)} crashed into airport (wrong direction)`;
          return false;
        }

        if (aircraft.destination.id !== cell.airport.id) {
          this.state.failure = `${aircraftLabel(aircraft)} landed at the wrong airport`;
          return false;
        }

        this.aircrafts.splice(i, 1);
        this.state.safe++;
        break;
      }

      // crash conditions
      for (let j = this.aircrafts.length - 1; j >= 0; --j) {
        if (i == j) continue;
        const other = this.aircrafts[j];
        const tooClose = Math.abs(aircraft.altitude - other.altitude) <= 3;
        if (aircraft.x === other.x && aircraft.y === other.y && tooClose) {
          this.state.failure = `${aircraftLabel(aircraft)} collided with ${aircraftLabel(other)}`;
          return false;
        }
      }
    }

    return true;
  }
}

{
  const mapInfo: MapInfo = JSON.parse(fs.readFileSync('map.json', 'utf-8'));
  mapInfo.exits = mapInfo.exits.map(([x, y, headingChar]) => {
    if (typeof headingChar === 'string') {
      return [x, y, characterToHeading[headingChar]];
    }

    return [x, y, headingChar];
  });

  const map = createMap(30, 21, mapInfo);
  const g = new Game(map);
  g.run();
}
