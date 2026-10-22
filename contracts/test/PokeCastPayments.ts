import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress, keccak256, parseUnits, toHex, zeroAddress, type Address, type Hex } from "viem";

const usdt = (n: number | string) => parseUnits(String(n), 18);

describe("PokeCastPayments", () => {
  async function deploy() {
    const [owner, signer, treasury, buyer, seller, attacker] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract("MockUSDT");
    const payments = await hre.viem.deployContract("PokeCastPayments", [
      token.address,
      treasury.account.address,
      signer.account.address,
      owner.account.address,
    ]);
    const publicClient = await hre.viem.getPublicClient();
    const chainId = await publicClient.getChainId();
    await token.write.mint([buyer.account.address, usdt(1000)]);
    await token.write.approve([payments.address, usdt(1000)], { account: buyer.account });

    let n = 0;
    const payment = (over: Partial<Payment> = {}): Payment => ({
      id: keccak256(toHex(`order-${n++}`)),
      payer: buyer.account.address,
      kind: 0,
      ref: keccak256(toHex("swsh7")),
      quantity: 1,
      amount: usdt(45),
      payee: zeroAddress,
      fee: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      ...over,
    });
    const sign = (p: Payment, by = signer) =>
      by.signTypedData({
        account: by.account,
        domain: { name: "PokeCast", version: "1", chainId, verifyingContract: payments.address },
        types: {
          Payment: [
            { name: "id", type: "bytes32" },
            { name: "payer", type: "address" },
            { name: "kind", type: "uint8" },
            { name: "ref", type: "bytes32" },
            { name: "quantity", type: "uint32" },
            { name: "amount", type: "uint256" },
            { name: "payee", type: "address" },
            { name: "fee", type: "uint256" },
            { name: "deadline", type: "uint64" },
          ],
        },
        primaryType: "Payment",
        message: p,
      });
    return { owner, signer, treasury, buyer, seller, attacker, token, payments, publicClient, payment, sign };
  }

  type Payment = {
    id: Hex;
    payer: Address;
    kind: number;
    ref: Hex;
    quantity: number;
    amount: bigint;
    payee: Address;
    fee: bigint;
    deadline: bigint;
  };

  it("sends pack payments to the treasury and emits Paid", async () => {
    const { payments, token, treasury, buyer, payment, sign, publicClient } = await loadFixture(deploy);
    const p = payment({ quantity: 3, amount: usdt(135) });
    const hash = await payments.write.pay([p, await sign(p)], { account: buyer.account });
    await publicClient.waitForTransactionReceipt({ hash });
    expect(await token.read.balanceOf([treasury.account.address])).to.equal(usdt(135));
    expect(await payments.read.used([p.id])).to.equal(true);
    const events = await payments.getEvents.Paid();
    expect(events).to.have.length(1);
    expect(events[0].args.quantity).to.equal(3);
    expect(getAddress(events[0].args.payee!)).to.equal(getAddress(treasury.account.address));
  });

  it("splits marketplace sales between seller and treasury", async () => {
    const { payments, token, treasury, seller, buyer, payment, sign } = await loadFixture(deploy);
    const p = payment({ kind: 1, amount: usdt(100), fee: usdt(2.5), payee: seller.account.address });
    await payments.write.pay([p, await sign(p)], { account: buyer.account });
    expect(await token.read.balanceOf([seller.account.address])).to.equal(usdt(97.5));
    expect(await token.read.balanceOf([treasury.account.address])).to.equal(usdt(2.5));
  });

  it("rejects a payment signed by anyone but the signer", async () => {
    const { payments, buyer, attacker, payment, sign } = await loadFixture(deploy);
    const p = payment({ amount: 1n });
    await expect(payments.write.pay([p, await sign(p, attacker)], { account: buyer.account })).to.be.rejectedWith("BadSignature");
  });

  it("rejects tampered amounts", async () => {
    const { payments, buyer, payment, sign } = await loadFixture(deploy);
    const p = payment();
    const sig = await sign(p);
    await expect(payments.write.pay([{ ...p, amount: 1n }, sig], { account: buyer.account })).to.be.rejectedWith("BadSignature");
  });

  it("only lets the named payer use a checkout", async () => {
    const { payments, attacker, payment, sign } = await loadFixture(deploy);
    const p = payment();
    await expect(payments.write.pay([p, await sign(p)], { account: attacker.account })).to.be.rejectedWith("NotPayer");
  });

  it("cannot be replayed", async () => {
    const { payments, buyer, payment, sign } = await loadFixture(deploy);
    const p = payment();
    const sig = await sign(p);
    await payments.write.pay([p, sig], { account: buyer.account });
    await expect(payments.write.pay([p, sig], { account: buyer.account })).to.be.rejectedWith("AlreadyUsed");
  });

  it("rejects expired checkouts and fees above the amount", async () => {
    const { payments, buyer, payment, sign } = await loadFixture(deploy);
    const old = payment({ deadline: 1n });
    await expect(payments.write.pay([old, await sign(old)], { account: buyer.account })).to.be.rejectedWith("Expired");
    const greedy = payment({ fee: usdt(46) });
    await expect(payments.write.pay([greedy, await sign(greedy)], { account: buyer.account })).to.be.rejectedWith("BadFee");
  });

  it("can be paused and only the owner manages settings", async () => {
    const { payments, owner, attacker, buyer, payment, sign } = await loadFixture(deploy);
    await expect(payments.write.pause({ account: attacker.account })).to.be.rejectedWith("OwnableUnauthorizedAccount");
    await expect(payments.write.setSigner([attacker.account.address], { account: attacker.account })).to.be.rejectedWith(
      "OwnableUnauthorizedAccount",
    );
    await payments.write.pause({ account: owner.account });
    const p = payment();
    await expect(payments.write.pay([p, await sign(p)], { account: buyer.account })).to.be.rejectedWith("EnforcedPause");
    await payments.write.unpause({ account: owner.account });
    await payments.write.pay([p, await sign(p)], { account: buyer.account });
  });

  it("stops accepting the old signer after rotation", async () => {
    const { payments, owner, attacker, buyer, payment, sign } = await loadFixture(deploy);
    await payments.write.setSigner([attacker.account.address], { account: owner.account });
    const p = payment();
    await expect(payments.write.pay([p, await sign(p)], { account: buyer.account })).to.be.rejectedWith("BadSignature");
    await payments.write.pay([p, await sign(p, attacker)], { account: buyer.account });
  });
});
