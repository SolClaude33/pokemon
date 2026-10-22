import { handler, requireUser } from "@/server/session";
import { profile } from "@/server/store";

export const GET = handler(async () => profile(await requireUser()));
