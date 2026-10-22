import { getSession, handler } from "@/server/session";
import { missions } from "@/server/store";

export const GET = handler(async () => ({ missions: await missions(await getSession()) }));
