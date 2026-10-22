import { handler, requireUser } from "@/server/session";
import { withdrawCashback } from "@/server/store";

export const POST = handler(async () => withdrawCashback(await requireUser()));
