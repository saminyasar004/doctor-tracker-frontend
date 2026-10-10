export const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
export const posInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
};
export function oneOf<T extends string>(v: unknown, opts: readonly T[]): T | undefined {
  return typeof v === "string" && (opts as readonly string[]).includes(v) ? (v as T) : undefined;
}
