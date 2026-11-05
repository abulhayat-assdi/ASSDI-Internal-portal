import type { Prisma } from "../../generated/customer-service";
type Tx = Prisma.TransactionClient;
type Scope = { courseId: string; workspaceId: string };
export const ACTIVE: string[];
export const DEFAULTS: Record<string, number>;
export function lock(tx: Tx, workspaceId: string): Promise<void>;
export function event(
  tx: Tx,
  s: Scope,
  actorId: string,
  type: string,
  conversationId?: string | null,
  data?: unknown,
): Promise<void>;
export function finishAssignments(
  tx: Tx,
  s: Scope,
  conversationId: string,
  now?: Date,
): Promise<void>;
export function dispatch(
  tx: Tx,
  s: Scope,
  config?: unknown,
  excluded?: string[],
): Promise<void>;
export function tick(
  tx: Tx,
  s: Scope,
  options?: { disable?: boolean; ineligible?: string[] },
): Promise<void>;
