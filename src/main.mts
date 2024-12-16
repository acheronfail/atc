import * as process from "node:process";
import { Game } from "./engine.ts";
import { listMaps, readMap } from "./map.ts";
import { TerminalUI } from "./ui/terminal.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";

// TODO: a description of how to play might be nice?

const args = parseArgs(Deno.args, {
  boolean: ["help", "list"],
  string: ["map"],
});

if (args.help) {
  console.warn("Usage: atc [options]");
  console.warn("  --help:       show this help message");
  console.warn("  --list:       list available maps");
  console.warn("  --map [map]:  select a map to play");
  Deno.exit(0);
}

const maps = await listMaps();
if (args.list) {
  console.log(maps.join("\n"));
  Deno.exit(0);
}

if (args.map && !maps.includes(args.map)) {
  console.error(`Map not found: ${args.map}`);
  Deno.exit(1);
}

const ui = new TerminalUI();
try {
  const map = await readMap(args.map ? args.map : "default");
  await new Game(map, ui).run();
} catch (err) {
  ui.close(err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
} finally {
  ui.close();
  process.exit(0);
}
