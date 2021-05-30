const web3 = require('web3');
const {accounts, contract} = require('@openzeppelin/test-environment');
const {BN, expectRevert, time, expectEvent, constants} = require('@openzeppelin/test-helpers');
const {expect} = require('chai');

const Farm = contract.fromArtifact('Farm');
const Token = contract.fromArtifact('Token');
const TokenMinter = contract.fromArtifact('TokenMinter');
const FaucetERC20 = contract.fromArtifact('FaucetERC20');
const Vault = contract.fromArtifact('Vault');

const mintAmount = '100';
const MINTED = web3.utils.toWei(mintAmount);
let tokenPerBlock;
const DEAD_ADDR = '0x000000000000000000000000000000000000dEaD';
let lpToken; // = this.LP1.address;
let tax = '100'; // 10%
let dev, user, taxTo;
function hours(total) {
    return parseInt(60 * 60 * total);
}

function fromWei(v) {
    return web3.utils.fromWei(v, 'ether').toString();
}

function toWei(v) {
    return web3.utils.toWei(v).toString();
}

describe('Vault test-cases', async function () {
    beforeEach(async function () {
        dev = accounts[0];
        user = accounts[1];
        devFeeAddr = accounts[2];
        tokenPerBlock = web3.utils.toWei('1');
        this.token = await Token.new('Token','Token', {from: dev});
        this.LP1 = await FaucetERC20.new("LP1", "LP1", MINTED, {from: dev});
        this.migrate_token = await FaucetERC20.new("Old", "Old", MINTED, {from: dev});

        this.minter = await TokenMinter.new(
            this.token.address, devFeeAddr, tax,
            "Minter","Minter",
            {from: dev});
        lpToken = this.LP1.address;
        await this.token.mint(dev, MINTED, {from: dev});

        const startBlock = (await time.latestBlock()).toString();
        // console.log('startBlock', startBlock);
        this.master = await Farm.new(
            this.token.address,
            this.minter.address,
            devFeeAddr,
            tokenPerBlock,
            startBlock,
            this.migrate_token.address,
            {from: dev});
        await this.token.transferOwnership(this.master.address, {from: dev});
        await this.minter.transferOwnership(this.master.address, {from: dev});

        this.vault = await Vault.new(
            this.token.address, this.minter.address, this.master.address,
            dev, devFeeAddr, {from: dev});

    });

    describe('TEST ALLOW VAULT TO FARM', async function () {
        const deposited = web3.utils.toWei('100');
        it('must only farm if allowed', async function () {
            await this.token.approve(this.vault.address, deposited, {from: dev});
            await expectRevert(this.vault.deposit(deposited, {from: dev}), 'contract not allowed');
            await this.master.adminSetContractStatus(this.vault.address, true, {from: dev});
            await this.vault.deposit(deposited, {from: dev});
        });
    } );

    describe('TEST DEPOSIT/WITHDRAW', async function () {
        const deposited = web3.utils.toWei('100');
        it('deposit and withdraw immediately', async function () {

            await this.master.adminSetContractStatus(this.vault.address, true, {from: dev});

            await this.token.approve(this.vault.address, deposited, {from: dev});
            await this.vault.deposit(deposited, {from: dev});

            // await time.advanceBlock();
            // const rewarded_1block = (await this.master.pendingToken(pid, dev, {from: dev})).toString();
            // expect( fromWei(rewarded_1block) ).to.be.equal('0.99999999999');

            await this.vault.withdrawAll({from: dev});

            // -0.1% withdraw fee
            const balanceOf = await this.token.balanceOf(dev, {from: dev});
            expect( fromWei(balanceOf) ).to.be.bignumber.equal('99.9');

        });

        it('deposit and withdraw +72h after', async function () {

            await this.master.adminSetContractStatus(this.vault.address, true, {from: dev});
            await this.master.adminSetWhiteList(this.vault.address, true, {from: dev});

            await this.token.approve(this.vault.address, deposited, {from: dev});
            await this.vault.deposit(deposited, {from: dev});

            await time.advanceBlock();
            await time.advanceBlock();
            await time.advanceBlock();

            const threeDays = time.duration.days(3);
            await time.increase(threeDays);

            await this.vault.harvest({from: dev});
            await this.vault.withdrawAll({from: dev});

            // advance 3 blocks + one harvest
            const balanceOf = await this.token.balanceOf(dev, {from: dev});
            expect( fromWei(balanceOf) ).to.be.equal('104.9');

        });

    } );

});
