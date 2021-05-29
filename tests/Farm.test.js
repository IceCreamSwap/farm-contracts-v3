const web3 = require('web3');
const {accounts, contract} = require('@openzeppelin/test-environment');
const {BN, expectRevert, time, expectEvent, constants} = require('@openzeppelin/test-helpers');
const {expect} = require('chai');

const Farm = contract.fromArtifact('Farm');
const Token = contract.fromArtifact('Token');
const TokenMinter = contract.fromArtifact('TokenMinter');
const FaucetERC20 = contract.fromArtifact('FaucetERC20');

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
    });

    /*
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

    describe('test withdraw before with lock (pay reward)', async function () {
        const pid = '1', deposited = web3.utils.toWei('100');
        const allocPoint = 1, depositFeeBP = 1000, withdrawFeeBP = 0, withdrawLockPeriod = 3600, withUpdate = true;
        it('reward must be paid', async function () {
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

            // const getLockPeriod = await this.master.getLockPeriod(dev, pid, {from: dev});
            // const isLocked = await this.master.isLocked(dev, pid, {from: dev});

            const oneDay = time.duration.days(1);

            await time.increase(oneDay);
            // const getLockPeriod1 = await this.master.getLockPeriod(dev, pid, {from: dev});
            // const isLocked1 = await this.master.isLocked(dev, pid, {from: dev});


            // console.log('getLockPeriod', getLockPeriod.toString(), oneDay.toString())
            // console.log('isLocked', isLocked)
            // console.log('getLockPeriod', getLockPeriod1.toString())
            // console.log('isLocked', isLocked1)

            const withdraw = web3.utils.toWei('90');
            await this.master.withdraw(pid, withdraw, {from: dev});

            const balanceOf = await this.LP1.balanceOf(dev, {from: dev});
            expect(balanceOf).to.be.bignumber.equal(withdraw);

            const balanceOfReward = await this.token.balanceOf(dev, {from: dev});
            expect('104.499999999955').to.be.equal( fromWei(balanceOfReward) ); // reward is paid

        });
    } );

    // DONE
    describe('contract security', async function () {
        const pid = 0;

        it('adminUpdateBonus', async function () {
            await expectRevert(this.master.adminUpdateBonus(0, {from: user}), 'Ownable: caller is not the owner');
            await this.master.adminUpdateBonus(0, {from: dev});
        });
        it('adminUpdateTokenPerBlock', async function () {
            await expectRevert(this.master.adminUpdateTokenPerBlock(tokenPerBlock, {from: user}), 'Ownable: caller is not the owner');
            await this.master.adminUpdateTokenPerBlock(tokenPerBlock, {from: dev});
        });
        it('adminSetDevFeeAddr', async function () {
            await expectRevert(this.master.adminSetDevFeeAddr(dev, {from: user}), 'Ownable: caller is not the owner');
            await this.master.adminSetDevFeeAddr(dev, {from: dev});
        });
        it('adminSetTaxAddr', async function () {
            await expectRevert(this.master.adminSetTaxAddr(dev, {from: user}), 'Ownable: caller is not the owner');
            await this.master.adminSetTaxAddr(dev, {from: dev});
        });
        it('adminSetTax', async function () {
            await expectRevert(this.master.adminSetTax(0, {from: user}), 'Ownable: caller is not the owner');
            await this.master.adminSetTax(0, {from: dev});
        });
        it('adminSetWhiteList', async function () {
            await expectRevert(this.master.adminSetWhiteList(dev, true, {from: user}), 'Ownable: caller is not the owner');
            await this.master.adminSetWhiteList(dev, true, {from: dev});
        });
        it('adminSetMinterStatus', async function () {
            await expectRevert(this.master.adminSetWhiteList(dev, true, {from: user}), 'Ownable: caller is not the owner');
            await this.master.adminSetWhiteList(dev, true, {from: dev});
        });
        it('adminSetStartBlock', async function () {
            await expectRevert(this.master.adminSetStartBlock(0, {from: user}), 'Ownable: caller is not the owner');
            await this.master.adminSetStartBlock(0, {from: dev});
        });
        it('adminMint', async function () {
            await expectRevert(this.master.adminMint(dev, 1, {from: user}), 'Ownable: caller is not the owner');
            await this.master.adminMint(dev, 1, {from: dev});
        });
        it('adminSetBurnAddr', async function () {
            await expectRevert(this.master.adminSetBurnAddr(dev, {from: user}), 'Ownable: caller is not the owner');
            await this.master.adminSetBurnAddr(dev, {from: dev});
        });
        it('adminSetContractStatus', async function () {
            await expectRevert(this.master.adminSetContractStatus(dev, true, {from: user}), 'Ownable: caller is not the owner');
            await this.master.adminSetContractStatus(dev, true, {from: dev});
        });

        it('add', async function () {
            const allocPoint = 1, depositFeeBP = 0, withdrawFeeBP = 0, withdrawLockPeriod = 0, withUpdate = true;
            await expectRevert(this.master.add(allocPoint, lpToken, depositFeeBP, withdrawFeeBP, withdrawLockPeriod, withUpdate, {from: user}),
                'Ownable: caller is not the owner');
            await this.master.add(allocPoint, lpToken, depositFeeBP, withdrawFeeBP, withdrawLockPeriod, withUpdate, {from: dev});
        });
        it('set', async function () {
            const allocPoint = 1, depositFeeBP = 0, withdrawFeeBP = 0, withdrawLockPeriod = 0, withUpdate = true;
            await expectRevert(this.master.set(pid, allocPoint, depositFeeBP, withdrawFeeBP, withdrawLockPeriod, withUpdate, {from: user}),
                'Ownable: caller is not the owner');
            await this.master.set(pid, allocPoint, depositFeeBP, withdrawFeeBP, withdrawLockPeriod, withUpdate, {from: dev});
        });


    });

    */

    /*
    describe('test deposit/withdraw', async function () {
        const pid = '1', deposited = web3.utils.toWei('100');
        const allocPoint = 1, depositFeeBP = 0, withdrawFeeBP = 0, withdrawLockPeriod = 0, withUpdate = true;


        it('deposit', async function () {
            await this.master.add(allocPoint, lpToken, depositFeeBP, withdrawFeeBP, withdrawLockPeriod, withUpdate, {from: dev});
            await this.LP1.approve(this.master.address, deposited, {from: dev});
            await this.master.deposit(pid, deposited, {from: dev});
            const userInfo = await this.master.userInfo(pid, dev, {from: dev});
            const pendingToken = (await this.master.pendingToken(pid, dev, {from: dev})).toString();
            const amount = userInfo.amount.toString();
            const rewardDebt = userInfo.rewardDebt.toString();

            // all must be 0 here
            expect(amount).to.be.equal(deposited);
            expect(rewardDebt).to.be.equal('0');
            expect(pendingToken).to.be.equal('0');

        });

        it('reward', async function () {
            await this.master.add(allocPoint, lpToken, depositFeeBP, withdrawFeeBP, withdrawLockPeriod, withUpdate, {from: dev});
            await this.LP1.approve(this.master.address, deposited, {from: dev});
            await this.master.deposit(pid, deposited, {from: dev});

            const reward_1block = web3.utils.toWei('1');
            const reward_2block = web3.utils.toWei('2');
            const reward_3block = web3.utils.toWei('3');

            await time.advanceBlock();
            const rewarded_1block = (await this.master.pendingToken(pid, dev, {from: dev})).toString();
            expect(rewarded_1block).to.be.bignumber.equal(reward_1block);

            await time.advanceBlock();
            const rewarded_2block = (await this.master.pendingToken(pid, dev, {from: dev})).toString();
            expect(rewarded_2block).to.be.bignumber.equal(reward_2block);

            await time.advanceBlock();
            const rewarded_3block = (await this.master.pendingToken(pid, dev, {from: dev})).toString();
            expect(rewarded_3block).to.be.bignumber.equal(reward_3block);

        });

        it('withdraw LP & reward', async function () {
            await this.master.add(allocPoint, lpToken, depositFeeBP, withdrawFeeBP, withdrawLockPeriod, withUpdate, {from: dev});
            await this.LP1.approve(this.master.address, deposited, {from: dev});
            await this.master.deposit(pid, deposited, {from: dev});


            const reward_1block = web3.utils.toWei('1');
            const reward_2block = web3.utils.toWei('2');
            const reward_3block = web3.utils.toWei('3');

            await time.advanceBlock();
            const rewarded_1block = (await this.master.pendingToken(pid, dev, {from: dev})).toString();
            expect(rewarded_1block).to.be.bignumber.equal(reward_1block);

            await time.advanceBlock();
            const rewarded_2block = (await this.master.pendingToken(pid, dev, {from: dev})).toString();
            expect(rewarded_2block).to.be.bignumber.equal(reward_2block);

            await time.advanceBlock();
            const rewarded_3block = (await this.master.pendingToken(pid, dev, {from: dev})).toString();
            expect(rewarded_3block).to.be.bignumber.equal(reward_3block);

            await this.master.withdraw(pid, deposited, {from: dev});

            const balanceOf = await this.LP1.balanceOf(dev, {from: dev});
            expect(balanceOf).to.be.bignumber.equal(deposited);

            const balanceOfReward = await this.token.balanceOf(dev, {from: dev});
            expect('103.6').to.be.equal( fromWei(balanceOfReward) );

        });
    } );

    describe('test deposit/withdraw with fees', async function () {
        const pid = '1', deposited = web3.utils.toWei('100');
        const allocPoint = 1, depositFeeBP = 1000, withdrawFeeBP = 0, withdrawLockPeriod = 0, withUpdate = true;
        it('deposit w/ 10% fee', async function () {
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
            expect('103.599999999964').to.be.equal( fromWei(balanceOfReward) );

        });
    } );
    */

    describe('emergencyWithdraw', async function () {
        const pid = '1', deposited = web3.utils.toWei('100');
        const allocPoint = 1, depositFeeBP = 0, withdrawFeeBP = 0, withdrawLockPeriod = 0, withUpdate = true;
        it('emergencyWithdraw - no lock period', async function () {

            await this.master.add(allocPoint, lpToken, depositFeeBP, withdrawFeeBP, withdrawLockPeriod, withUpdate, {from: dev});
            await this.LP1.approve(this.master.address, deposited, {from: dev});
            await this.master.deposit(pid, deposited, {from: dev});

            const balanceOfToken1 = await this.token.balanceOf(dev);
            expect(balanceOfToken1).to.be.bignumber.equal(MINTED);

            await this.master.emergencyWithdraw(pid, {from: dev});

            // 2 blocks only, 100% must be burned, user get 0% and Token reward
            const balanceOfLP = web3.utils.fromWei(await this.LP1.balanceOf(dev),'ether').toString();
            const balanceOfTokenBurned = web3.utils.fromWei(await this.LP1.balanceOf(DEAD_ADDR),'ether').toString();
            expect(balanceOfLP).to.be.bignumber.equal('100');
            expect(balanceOfTokenBurned).to.be.bignumber.equal('0');

            // no token reward
            const tokenRewarded = web3.utils.fromWei(await this.token.balanceOf(dev),'ether').toString();
            expect('100').to.be.equal(parseFloat(tokenRewarded).toFixed(0));

        });


    });


});
