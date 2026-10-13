import { test } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

test("SettlementVault accepts deposits", async () => {
    const { viem } = await network.connect();
    const vault = await viem.deployContract("SettlementVault");
    const [user] = await viem.getWalletClients();

    await vault.write.deposit({
        account: user.account,
        value: 1000000000000000000n,
    });

    const balance = await vault.read.balances([user.account.address]);

    assert.equal(balance, 1000000000000000000n);
});

test("SettlementVault supports partial and full withdrawals", async () => {
    const { viem } = await network.connect();
    const vault = await viem.deployContract("SettlementVault");
    const [user] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    const deposited = 1000000000000000000n;
    const partial = 400000000000000000n;

    await vault.write.deposit({ account: user.account, value: deposited });
    await vault.write.withdraw({ account: user.account, args: [partial] });

    assert.equal(await vault.read.balances([user.account.address]), deposited - partial);
    assert.equal(await publicClient.getBalance({ address: vault.address }), deposited - partial);

    await vault.write.withdraw({ account: user.account, args: [deposited - partial] });

    assert.equal(await vault.read.balances([user.account.address]), 0n);
    assert.equal(await publicClient.getBalance({ address: vault.address }), 0n);
});

test("SettlementVault rejects zero withdrawals without changing balances", async () => {
    const { viem } = await network.connect();
    const vault = await viem.deployContract("SettlementVault");
    const [user] = await viem.getWalletClients();
    const deposited = 1000000000000000000n;

    await vault.write.deposit({ account: user.account, value: deposited });
    await assert.rejects(vault.write.withdraw({ account: user.account, args: [0n] }));

    assert.equal(await vault.read.balances([user.account.address]), deposited);
    assert.equal(
        await (await viem.getPublicClient()).getBalance({ address: vault.address }),
        deposited,
    );
});

test("SettlementVault rejects withdrawals above the recorded balance", async () => {
    const { viem } = await network.connect();
    const vault = await viem.deployContract("SettlementVault");
    const [user] = await viem.getWalletClients();
    const deposited = 1000000000000000000n;

    await vault.write.deposit({ account: user.account, value: deposited });
    await assert.rejects(
        vault.write.withdraw({ account: user.account, args: [deposited + 1n] }),
    );

    assert.equal(await vault.read.balances([user.account.address]), deposited);
    assert.equal(
        await (await viem.getPublicClient()).getBalance({ address: vault.address }),
        deposited,
    );
});

test("SettlementVault sends withdrawals to contract recipients", async () => {
    const { viem } = await network.connect();
    const vault = await viem.deployContract("SettlementVault");
    const receiver = await viem.deployContract("SettlementVaultReceiver");
    const [user] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    const deposited = 1000000000000000000n;
    const initialReceiverBalance = await publicClient.getBalance({ address: receiver.address });

    await receiver.write.depositInto([vault.address], {
        account: user.account,
        value: deposited,
    });
    await receiver.write.withdrawFrom([vault.address, deposited], { account: user.account });

    assert.equal(await vault.read.balances([receiver.address]), 0n);
    assert.equal(await publicClient.getBalance({ address: vault.address }), 0n);
    assert.equal(
        await publicClient.getBalance({ address: receiver.address }),
        initialReceiverBalance + deposited,
    );
});

test("SettlementVault rolls back withdrawal accounting when a recipient rejects ETH", async () => {
    const { viem } = await network.connect();
    const vault = await viem.deployContract("SettlementVault");
    const receiver = await viem.deployContract("RejectingSettlementVaultReceiver");
    const [user] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    const deposited = 1000000000000000000n;

    await receiver.write.depositInto([vault.address], {
        account: user.account,
        value: deposited,
    });
    await assert.rejects(
        receiver.write.withdrawFrom([vault.address, deposited], { account: user.account }),
    );

    assert.equal(await vault.read.balances([receiver.address]), deposited);
    assert.equal(await publicClient.getBalance({ address: vault.address }), deposited);
    assert.equal(await publicClient.getBalance({ address: receiver.address }), 0n);
});