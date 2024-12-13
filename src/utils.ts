import { Aircraft } from "./aircraft.ts";

export function aircraftLabel({ type, id, altitude }: Aircraft) {
  const label = type === "prop" ? id.toUpperCase() : id.toLowerCase();
  return `${label}${altitude}`;
}

export function randomIndex(arr: unknown[]): number {
  return Math.floor(Math.random() * arr.length);
}

export function random<T>(arr: []): null;
export function random<T>(arr: T[] | []): T;
export function random<T>(arr: T[] | []): T | null {
  if (arr.length === 0) return null;
  const i = randomIndex(arr);
  return arr[i];
}