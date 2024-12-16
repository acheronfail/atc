export enum Direction {
  Up = "^",
  Down = "v",
  Left = "<",
  Right = ">",
}

export const HEADING_COUNT = 8;
export enum Heading {
  North,
  NorthEast,
  East,
  SouthEast,
  South,
  SouthWest,
  West,
  NorthWest,
}

export const headingToCharacter: Record<Heading, string> = {
  [Heading.North]: "w",
  [Heading.NorthEast]: "e",
  [Heading.East]: "d",
  [Heading.SouthEast]: "c",
  [Heading.South]: "x",
  [Heading.SouthWest]: "z",
  [Heading.West]: "a",
  [Heading.NorthWest]: "q",
};

export const characterToHeading: Record<string, Heading> = Object.fromEntries(
  Object.entries(headingToCharacter).map(([a, b]) => [b, parseInt(a)]),
);

export const headingNameMap: Record<Heading, string> = {
  [Heading.North]: "North",
  [Heading.NorthEast]: "NorthEast",
  [Heading.East]: "East",
  [Heading.SouthEast]: "SouthEast",
  [Heading.South]: "South",
  [Heading.SouthWest]: "SouthWest",
  [Heading.West]: "West",
  [Heading.NorthWest]: "NorthWest",
};

export function headingMatchesDirection(
  heading: Heading,
  direction: Direction,
): boolean {
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
