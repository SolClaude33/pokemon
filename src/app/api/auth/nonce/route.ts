import { handler, issueNonce } from "@/server/session";

export const GET = handler(async () => ({ nonce: await issueNonce() }));
