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

describe('Farm test-cases', async function () {
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

    describe('test withdraw before with lock (no reward)', async function () {
        const pid = '1', deposited = web3.utils.toWei('100');
        const allocPoint = 1, depositFeeBP = 1000, withdrawFeeBP = 0, withdrawLockPeriod = 3600, withUpdate = true;
        it('reward must NOT be paid', async function () {
            await this.master.add(allocPoint, lpToken, depositFeeBP, withdrawFeeBP, withdrawLockPeriod, withUpdate, {from: dev});
            await this.LP1.approve(this.master.address, deposited, {from: dev});
            await this.master.deposit(pid, deposited, {from: dev});

            await time.advanceBlock();
            const rewarded_1block = (await this.master.pendingToken(pid, dev, {from: dev})).toString();
            expect( fromWei(rewarded_1block) ).to.be.equal('0.99999999999');

            await time.advanceBlock();
            const rewarded_2block = (await this.master.pendingToken(pid, dev, {from: dev})).toString();
            expect( fromWei(rewarded_2block) ).to.be.equal('1.99999999998');

            await time.advanceBlock();
            const rewarded_3block = (await this.master.pendingToken(pid, dev, {from: dev})).toString();
            expect( fromWei(rewarded_3block) ).to.be.equal('2.99999999997');

            const withdraw = web3.utils.toWei('90');
            await this.master.withdraw(pid, withdraw, {from: dev});

            const balanceOf = await this.LP1.balanceOf(dev, {from: dev});
            expect(balanceOf).to.be.bignumber.equal(withdraw);

            const balanceOfReward = await this.token.balanceOf(dev, {from: dev});
            expect('100').to.be.equal( fromWei(balanceOfReward) ); // no reward paid

        });
    } );

});
