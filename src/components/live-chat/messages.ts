// Preserve paginated history while new messages arrive or a request is retried.
export function mergeMessages<
  T extends { id: string; createdAt: string; sequence?: string },
>(older: T[], newer: T[]) {
  const values = new Map(older.map((m) => [m.id, m]));
  for (const m of newer) values.set(m.id, m);
  return [...values.values()].sort((a, b) =>
    a.sequence && b.sequence
      ? BigInt(a.sequence) < BigInt(b.sequence)
        ? -1
        : BigInt(a.sequence) > BigInt(b.sequence)
          ? 1
          : 0
      : a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
