import { parseUnits } from "viem";
import { USDT_DECIMALS } from "./config";

export const toUsdtUnits = (usdt: number) => parseUnits(usdt.toFixed(6), USDT_DECIMALS);
