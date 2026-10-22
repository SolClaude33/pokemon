import { handler } from "@/server/session";
import { marketListings } from "@/server/store";

export const GET = handler(async () => ({ listings: await marketListings() }));
