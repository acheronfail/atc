import { describe, test } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Aircraft } from "./aircraft.ts";
import { readMap } from "./map.ts";
import { Heading, HEADING_COUNT } from "./heading.ts";

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
      aircraft.performCommand(0, map);
      expect(aircraft.altitude).toBe(6);
      aircraft.performCommand(0, map);
      expect(aircraft.altitude).toBe(5);
      aircraft.performCommand(0, map);
      expect(aircraft.altitude).toBe(4);
      aircraft.performCommand(0, map);
      expect(aircraft.altitude).toBe(3);
      aircraft.performCommand(0, map);
      expect(aircraft.altitude).toBe(2);
      aircraft.performCommand(0, map);
      expect(aircraft.altitude).toBe(1);
    });

    function testHeadingNavigation(start: Heading, end: Heading, expected: Heading[]) {
      test(`heading: ${Heading[start]} -> ${Heading[end]}`, () => {
        const aircraft = Aircraft.create(map, [], TestAircraft)!;
        aircraft.heading = start;
        aircraft.command = { turn: { heading: end } };

        for (const heading of expected) {
          aircraft.performCommand(0, map);
          expect(aircraft.heading).toBe(heading);
        }
      });
    }

    for (let heading = 0; heading < HEADING_COUNT; heading++) {
      const next = (n: number) => (heading + n) % HEADING_COUNT;

      testHeadingNavigation(heading, heading, [heading]);
      testHeadingNavigation(heading, next(1), [next(1)]);
      testHeadingNavigation(heading, next(2), [next(2)]);
      testHeadingNavigation(heading, next(3), [next(2), next(3)]);
      testHeadingNavigation(heading, next(4), [next(2), next(4)]);
      testHeadingNavigation(heading, next(5), [next(6), next(5)]);
      testHeadingNavigation(heading, next(6), [next(6)]);
      testHeadingNavigation(heading, next(7), [next(7)]);
    }
  });
});
