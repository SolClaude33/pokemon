// Local development only: deploys MockUSDT + PokeCastPayments to the Hardhat node,
// funds the first five test accounts and writes the addresses into ../.env.local.
// Run: npx hardhat node   (in another terminal)
//      npx hardhat run scripts/deploy-local.ts --network localhost
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const envPath = path.resolve(process.cwd(), "../.env.local");
  let env = readFileSync(envPath, "utf8");
  const key = env.match(/^SIGNER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})$/m)?.[1];
  const treasury = env.match(/^NEXT_PUBLIC_TREASURY_ADDRESS=(0x[0-9a-fA-F]{40})$/m)?.[1];
  if (!key || !treasury) throw new Error("SIGNER_PRIVATE_KEY and NEXT_PUBLIC_TREASURY_ADDRESS must be in .env.local");
  const signer = privateKeyToAccount(key as `0x${string}`).address;

  const wallets = await hre.viem.getWalletClients();
  const owner = wallets[0];
  const usdt = await hre.viem.deployContract("MockUSDT");
  const payments = await hre.viem.deployContract("PokeCastPayments", [usdt.address, treasury as `0x${string}`, signer, owner.account.address]);
  for (const w of wallets.slice(0, 5)) await usdt.write.mint([w.account.address, parseUnits("10000", 18)]);

  const set = (k: string, v: string) => {
    env = new RegExp(`^${k}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`) : `${env.trimEnd()}\n${k}=${v}\n`;
  };
  set("NEXT_PUBLIC_USDT_ADDRESS", usdt.address);
  set("NEXT_PUBLIC_PAYMENTS_ADDRESS", payments.address);
  writeFileSync(envPath, env);
  console.log(`MockUSDT ${usdt.address}\nPokeCastPayments ${payments.address}\nsigner ${signer}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
