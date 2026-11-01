import "server-only";
import { PrismaClient, Prisma } from "../../../generated/customer-service";
export class CrmError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const globalCrm = globalThis as unknown as { crm?: PrismaClient };
export function crmClient() {
  const value = process.env.CUSTOMER_SERVICE_DATABASE_URL;
  if (!value)
    throw new CrmError(
      503,
      "Customer service is not configured. Contact your administrator.",
    );
  if (!globalCrm.crm) {
    const url = new URL(value);
    url.searchParams.set("connection_limit", "5");
    url.searchParams.set("connect_timeout", "5");
    url.searchParams.set("pool_timeout", "5");
    globalCrm.crm = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
  }
  return globalCrm.crm;
}
export type Tx = Prisma.TransactionClient;
export async function scoped<T>(
  courseId: string,
  workspaceId: string,
  fn: (tx: Tx) => Promise<T>,
) {
  if (!courseId) throw new CrmError(403, "Course required");
  return crmClient().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('crm.course', ${courseId}, true), set_config('crm.workspace', ${workspaceId}, true)`;
      return fn(tx);
    },
    { maxWait: 5000, timeout: 15000 },
  );
}
