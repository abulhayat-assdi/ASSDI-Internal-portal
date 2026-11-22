import { userDbClient } from "@/lib/typing-game/server/auth";
import { featureOn } from "@/lib/typing-game/server/features";
import { FeatureOff } from "@/components/typing-game/feature-off";

export const dynamic = "force-dynamic";

/** Switched off by the course admin (Features page) → nothing here is reachable. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await featureOn(await userDbClient(), "MISSIONS_ENABLED"))) return <FeatureOff title="মিশন" />;
  return <>{children}</>;
}
