import { describe, test } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Aircraft } from "./aircraft.ts";
import { readMap } from "./map.ts";
import { Heading } from "./heading.ts";

const map = await readMap("default");

class TestAircraft extends Aircraft {
  label() {
    return this.id + this.altitude + ":test";
  }

  shouldUpdate(_: number) {
    return true;
  }
}

describe(Aircraft.name, () => {
  describe(Aircraft.prototype.performCommand.name, () => {
    test("should update altitude", () => {
      const aircraft = Aircraft.create(map, [], TestAircraft)!;
      expect(aircraft.altitude).toBe(7);

      aircraft.command = { altitude: 1 };
      aircraft.performCommand(0);
      expect(aircraft.altitude).toBe(6);
      aircraft.performCommand(0);
      expect(aircraft.altitude).toBe(5);
      aircraft.performCommand(0);
      expect(aircraft.altitude).toBe(4);
      aircraft.performCommand(0);
      expect(aircraft.altitude).toBe(3);
      aircraft.performCommand(0);
      expect(aircraft.altitude).toBe(2);
      aircraft.performCommand(0);
      expect(aircraft.altitude).toBe(1);
    });

    function testHeadingNavigation(start: Heading, end: Heading, expected: Heading[]) {
      test(`heading: ${Heading[start]} -> ${Heading[end]}`, () => {
        const aircraft = Aircraft.create(map, [], TestAircraft)!;
        aircraft.heading = start;
        aircraft.command = { turn: end };

        for (const heading of expected) {
          aircraft.performCommand(0);
          expect(aircraft.heading).toBe(heading);
        }
      });
    }

    testHeadingNavigation(Heading.North, Heading.North, [Heading.North]);
    testHeadingNavigation(Heading.North, Heading.NorthEast, [Heading.NorthEast]);
    testHeadingNavigation(Heading.North, Heading.East, [Heading.East]);
    testHeadingNavigation(Heading.North, Heading.SouthEast, [Heading.East, Heading.SouthEast]);
    testHeadingNavigation(Heading.North, Heading.South, [Heading.East, Heading.South]);
    testHeadingNavigation(Heading.North, Heading.SouthWest, [Heading.West, Heading.SouthWest]);
    testHeadingNavigation(Heading.North, Heading.West, [Heading.West]);
    testHeadingNavigation(Heading.North, Heading.NorthWest, [Heading.NorthWest]);
  });
});
