import type { Prisma } from "../../generated/customer-service";
type Tx = Prisma.TransactionClient;
type Scope = { courseId: string; workspaceId: string };
export function ensureDefaults(
  tx: Tx,
  s: Scope,
  settings?: unknown,
): Promise<void>;
export function seedPractice(
  tx: Tx,
  s: Scope,
  settings?: unknown,
  actorId?: string,
): Promise<{ added: number; total: number }>;
export function advancePractice(tx: Tx, s: Scope, c: unknown): Promise<void>;
export const scenarios: string[][];
