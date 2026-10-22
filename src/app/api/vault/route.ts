import { handler, requireUser } from "@/server/session";
import { vault } from "@/server/store";

export const GET = handler(async () => vault(await requireUser()));
