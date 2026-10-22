import { handler, requireUser } from "@/server/session";
import { claimMission } from "@/server/store";

export const POST = handler(async (req) => {
  const address = await requireUser();
  const { missionId } = (await req.json()) as { missionId: string };
  return claimMission(address, missionId);
});
