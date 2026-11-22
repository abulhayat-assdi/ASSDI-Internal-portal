import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { featureOn } from "@/lib/typing-game/server/features";
import { FeatureOff } from "@/components/typing-game/feature-off";
import { CompeteHub } from "@/components/typing-game/compete/compete-hub";

export default async function CompetePage() {
  await studentContext(DEFAULT_LOCALE);
  if (!(await featureOn(await userDbClient(), "BATCH_COMPETITION_ENABLED"))) return <FeatureOff title="ব্যাচ কম্পিটিশন" />;
  return <CompeteHub />;
}
