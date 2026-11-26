// STE100: fixed CPU workload used for both local and remote measurement.
const itemsSource = `const items = Array.from({ length: 5000 }, (_, index) => ({
    id: index,
    status: index % 7 === 0 ? "blocked" : "open",
    amount: (index * 37) % 1000,
    tag: "t" + (index % 11)
  }));`;

export const workload = `export default async () => {
  ${itemsSource}
  const started = performance.now();
  const blocked = items.filter((item) => item.status === "blocked");
  const byTag = {};
  for (const item of blocked) {
    byTag[item.tag] = (byTag[item.tag] ?? 0) + item.amount;
  }
  const total = Object.values(byTag).reduce((sum, value) => sum + value, 0);
  return {
    elapsedMs: performance.now() - started,
    blocked: blocked.length,
    groups: Object.keys(byTag).length,
    total
  };
};`;

export const rawWorkload = `export default async () => {
  ${itemsSource}
  return { bytes: JSON.stringify(items).length };
};`;

export type Result = {
  elapsedMs: number;
  blocked: number;
  groups: number;
  total: number;
};
