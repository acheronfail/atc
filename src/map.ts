import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import { GameMap, Item, MapInfo } from "./types.ts";
import { characterToHeading } from "./heading.ts";
import path from "node:path";

export async function readMap(name: string): Promise<GameMap> {
  const info: MapInfo = JSON.parse(await fs.readFile(path.join("maps", `${name}.json`), "utf-8"));
  info.exits = info.exits.map(([x, y, headingChar]) => {
    if (typeof headingChar === "string") {
      return [x, y, characterToHeading[headingChar]];
    }

    return [x, y, headingChar];
  });

  return createMap(info);
}

function createMap(info: MapInfo) {
  const map: GameMap = { x: info.width, y: info.height, grid: [], info };
  for (let i = 0; i < info.height; ++i) {
    const row: Item[] = [];
    for (let j = 0; j < info.width; ++j) {
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
