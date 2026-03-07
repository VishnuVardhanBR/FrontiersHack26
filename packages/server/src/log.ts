const trunc = (value: unknown, max = 120): string => {
  const s = typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

const ts = () => new Date().toISOString().slice(11, 23);

export const log = (tag: string, ...parts: unknown[]) => {
  console.log(`${ts()} [${tag}]`, ...parts.map((p) => (typeof p === "string" ? p : trunc(p))));
};

export const warn = (tag: string, ...parts: unknown[]) => {
  console.warn(`${ts()} [${tag}]`, ...parts.map((p) => (typeof p === "string" ? p : trunc(p))));
};

export const err = (tag: string, ...parts: unknown[]) => {
  console.error(`${ts()} [${tag}]`, ...parts.map((p) => (p instanceof Error ? p.message : trunc(p))));
};

export const truncate = trunc;
