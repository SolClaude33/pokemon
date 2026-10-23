// Local development only: deploys MockUSDT to the Hardhat node, funds the first
// five test accounts and writes its address into ../.env.local.
// Run: npx hardhat node   (in another terminal)
//      npx hardhat run scripts/deploy-local.ts --network localhost
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { parseUnits } from "viem";

async function main() {
  const envPath = path.resolve(process.cwd(), "../.env.local");
  let env = readFileSync(envPath, "utf8");
  if (!/^NEXT_PUBLIC_TREASURY_ADDRESS=0x[0-9a-fA-F]{40}$/m.test(env)) throw new Error("NEXT_PUBLIC_TREASURY_ADDRESS must be in .env.local");

  const wallets = await hre.viem.getWalletClients();
  const usdt = await hre.viem.deployContract("MockUSDT");
  for (const w of wallets.slice(0, 5)) await usdt.write.mint([w.account.address, parseUnits("10000", 18)]);

  const set = (k: string, v: string) => {
    env = new RegExp(`^${k}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`) : `${env.trimEnd()}\n${k}=${v}\n`;
  };
  set("NEXT_PUBLIC_USDT_ADDRESS", usdt.address);
  writeFileSync(envPath, env);
  console.log(`MockUSDT ${usdt.address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
