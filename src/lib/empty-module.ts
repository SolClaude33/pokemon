// Stub for @coinbase/cdp-sdk, pulled in by wagmi's Base Account connector for
// server-side Base payments that Holovision (BNB Chain) never uses. Its optional
// @x402/* peers are not installed, so the real module cannot be bundled.
export class CdpClient {
  constructor() {
    throw new Error("@coinbase/cdp-sdk is not available in Holovision");
  }
}
