import * as process from "node:process";
import { Game } from "./engine.ts";
import { readMap } from "./map.ts";
import { TerminalUI } from "./ui/terminal.ts";

const ui = new TerminalUI();
try {
  const map = await readMap("default");
  const g = new Game(map, ui);
  await g.run();
} catch (err) {
  ui.close(err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
} finally {
  ui.close();
  process.exit(0);
}