import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { parseUnits } from "viem";

describe("Derizer", async function () {
  const { viem } = await network.create();

  async function deployDerizer() {
    const [owner, alice] = await viem.getWalletClients();
    const derizer = await viem.deployContract("Derizer");
    return { derizer, owner, alice };
  }

  it("has the correct name and symbol", async function () {
    const { derizer } = await deployDerizer();

    assert.equal(await derizer.read.name(), "Derizer");
    assert.equal(await derizer.read.symbol(), "DRZ");
  });

  it("has 18 decimals", async function () {
    const { derizer } = await deployDerizer();

    assert.equal(await derizer.read.decimals(), 18);
  });

  it("mints the full fixed supply to the deployer", async function () {
    const { derizer, owner } = await deployDerizer();

    const expectedSupply = parseUnits("21000000", 18);

    assert.equal(await derizer.read.totalSupply(), expectedSupply);
    assert.equal(
      await derizer.read.balanceOf([owner.account.address]),
      expectedSupply,
    );
  });

  it("has no mint function reachable after deployment", async function () {
    const { derizer } = await deployDerizer();

    // Fixed-supply token: there should be no public/external `mint` in the ABI.
    const hasMintFunction = derizer.abi.some(
      (item: { type: string; name?: string }) =>
        item.type === "function" && item.name === "mint",
    );

    assert.equal(hasMintFunction, false);
  });

  it("transfers tokens between accounts", async function () {
    const { derizer, owner, alice } = await deployDerizer();

    const amount = parseUnits("1000", 18);

    await derizer.write.transfer([alice.account.address, amount]);

    assert.equal(await derizer.read.balanceOf([alice.account.address]), amount);
    assert.equal(
      await derizer.read.balanceOf([owner.account.address]),
      parseUnits("21000000", 18) - amount,
    );
  });

  it("emits a Transfer event on transfer", async function () {
    const { derizer, owner, alice } = await deployDerizer();

    const amount = parseUnits("500", 18);

    await viem.assertions.emitWithArgs(
      derizer.write.transfer([alice.account.address, amount]),
      derizer,
      "Transfer",
      [owner.account.address, alice.account.address, amount],
    );
  });

  it("reverts when transferring more than the balance", async function () {
    const { derizer, alice } = await deployDerizer();
  
    const tooMuch = parseUnits("21000001", 18); // 1 more than total supply
  
    await viem.assertions.revertWithCustomError(
      derizer.write.transfer([alice.account.address, tooMuch]),
      derizer,
      "ERC20InsufficientBalance",
    );
  });

  it("approves and transfers via allowance (transferFrom)", async function () {
    const { derizer, owner, alice } = await deployDerizer();

    const amount = parseUnits("250", 18);

    await derizer.write.approve([alice.account.address, amount]);
    assert.equal(
      await derizer.read.allowance([owner.account.address, alice.account.address]),
      amount,
    );

    await derizer.write.transferFrom(
      [owner.account.address, alice.account.address, amount],
      { account: alice.account },
    );

    assert.equal(await derizer.read.balanceOf([alice.account.address]), amount);
    assert.equal(
      await derizer.read.allowance([owner.account.address, alice.account.address]),
      0n,
    );
  });
});