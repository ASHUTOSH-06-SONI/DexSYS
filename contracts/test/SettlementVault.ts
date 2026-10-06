import { test } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

test("SettlementVault accepts deposits", async () => {
    const { viem } = await network.connect();
    const vault = await viem.deployContract("SettlementVault");
    const [user] = await viem.getWalletClients();

    await vault.write.deposit({
        account: user.account,
        value: 1000000000000000000n
    });

    const balance = await vault.read.balances([user.account.address]);

    assert.equal(balance, 1000000000000000000n);
});