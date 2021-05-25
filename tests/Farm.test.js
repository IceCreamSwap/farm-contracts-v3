const web3 = require('web3');
const {accounts, contract} = require('@openzeppelin/test-environment');
const {BN, expectRevert, token, expectEvent, constants} = require('@openzeppelin/test-helpers');
const {expect} = require('chai');

const Farm = contract.fromArtifact('Farm');
const Token = contract.fromArtifact('Token');
const TokenMinter = contract.fromArtifact('TokenMinter');
const FaucetERC20 = contract.fromArtifact('FaucetERC20');
const MINTED = web3.utils.toWei(mintAmount);
let tokenPerBlock;
let busdPerBlock;
const DEAD_ADDR = '0x000000000000000000000000000000000000dEaD';
let lpToken; // = this.LP1.address;

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
        busdWallet = accounts[2];
        tokenPerBlock = web3.utils.toWei('1');
        busdPerBlock = web3.utils.toWei('1');
        this.token = await Token.new({from: dev});
        this.LP1 = await FaucetERC20.new("LP1", "LP1", MINTED, {from: dev});
        this.BUSD = await FaucetERC20.new("BUSD", "BUSD", MINTED, {from: busdWallet});
        this.minter = await TokenMinter.new({from: dev});
        lpToken = this.LP1.address;
        await this.token.mint(dev, MINTED, {from: dev});

        const startBlock = (await token.latestBlock()).toString();
        // console.log('startBlock', startBlock);
        this.master = await Farm.new(
            this.token.address,
            this.BUSD.address,
            dev,
            busdWallet,
            tokenPerBlock,
            busdPerBlock,
            startBlock, {from: dev});
        await this.token.transferOwnership(this.master.address, {from: dev});
        await this.minter.transferOwnership(this.master.address, {from: dev});
    });



    describe('CONTRACT MANAGEMENT SECURITY', async function () {
        const pid = 0;
        it('updateTokenPerBlock', async function () {
            await expectRevert(this.master.updateTokenPerBlock(tokenPerBlock, {from: user}), 'Ownable: caller is not the owner');
            await this.master.updateTokenPerBlock(tokenPerBlock, {from: dev});
        });
        it('updateMultiplier', async function () {
            await expectRevert(this.master.updateMultiplier('1', {from: user}), 'Ownable: caller is not the owner');
            await this.master.updateMultiplier('1', {from: dev});
        });
        it('add', async function () {
            const allocPoint = 1, burnRate = 0, emergencyBurnRate = 0, lockPeriod = 0, depositBurnRate = 0, secondaryReward = false, withUpdate = true;
            // add(uint256 _allocPoint, IBEP20 _lpToken, uint256 _burnRate, uint256 _emergencyBurnRate, uint256 _lockPeriod, uint256 _depositBurnRate, bool _withUpdate )
            await expectRevert(this.master.add(allocPoint, lpToken, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, withUpdate, {from: user}),
                'Ownable: caller is not the owner');
            await this.master.add(allocPoint, lpToken, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, withUpdate, {from: dev});
        });
        it('set', async function () {
            const allocPoint = 1, burnRate = 0, emergencyBurnRate = 0, lockPeriod = 0, depositBurnRate = 0, secondaryReward = false, withUpdate = true;
            // set(uint256 _pid, uint256 _allocPoint, uint256 _burnRate, uint256 _emergencyBurnRate, uint256 _lockPeriod, uint256 _depositBurnRate, bool _withUpdate )
            await expectRevert(this.master.set(pid, allocPoint, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, withUpdate, {from: user}),
                'Ownable: caller is not the owner');
            await this.master.add(pid, lpToken, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, withUpdate, {from: dev});
            await this.master.set(pid, allocPoint, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, withUpdate, {from: dev});
        });
    });




    describe('user interaction', async function () {

        it('deposit', async function () {
            const pid = '0', deposited = web3.utils.toWei('100');
            const allocPoint = 1, burnRate = 0, emergencyBurnRate = 0, lockPeriod = 0, depositBurnRate = 0, secondaryReward = false, withUpdate = true;
            await this.master.add(allocPoint, lpToken, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, withUpdate, {from: dev});
            await this.LP1.approve(this.master.address, deposited, {from: dev});
            await this.master.deposit(pid, deposited, {from: dev});
            const userInfo = await this.master.userInfo(pid, dev, {from: dev});
            const pendingReward = (await this.master.pendingReward(pid, dev, {from: dev}));
            const tokenPendingReward = pendingReward[0].toString();
            const busdPendingReward = pendingReward[1].toString();
            // console.log('pendingReward', tokenPendingReward, busdPendingReward)
            const amount = userInfo.amount.toString();
            const rewardDebt = userInfo.rewardDebt.toString();
            const lastDepositToken = parseInt(userInfo.lastDepositToken.toString());

            // all must be 0 here
            expect(amount).to.be.equal(deposited);
            expect(rewardDebt).to.be.equal('0');
            expect(tokenPendingReward).to.be.equal('0');
            expect(busdPendingReward).to.be.equal('0');

        });

        it('reward', async function () {
            const pid = '0', deposited = web3.utils.toWei('100');
            const allocPoint = 1, burnRate = 0, emergencyBurnRate = 0, lockPeriod = 0, depositBurnRate = 0, secondaryReward = false, withUpdate = true;
            await this.master.add(allocPoint, lpToken, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, withUpdate, {from: dev});
            await this.LP1.approve(this.master.address, deposited, {from: dev});
            await this.master.deposit(pid, deposited, {from: dev});

            const reward_1block = web3.utils.toWei('1');
            const reward_2block = web3.utils.toWei('2');
            const reward_3block = web3.utils.toWei('3');

            await token.advanceBlock();
            const rewarded_1block = (await this.master.pendingReward(pid, dev, {from: dev}))[0].toString();
            expect(rewarded_1block).to.be.bignumber.equal(reward_1block);

            await token.advanceBlock();
            const rewarded_2block = (await this.master.pendingReward(pid, dev, {from: dev}))[0].toString();
            expect(rewarded_2block).to.be.bignumber.equal(reward_2block);

            await token.advanceBlock();
            const rewarded_3block = (await this.master.pendingReward(pid, dev, {from: dev}))[0].toString();
            expect(rewarded_3block).to.be.bignumber.equal(reward_3block);

        });


        it('DEPOSIT TOKEN / EARN TOKEN / on WITHDRAW / AFTER PERIOD / BURN 100% TOKEN', async function () {
            const LP = this.token.address;
            const pid = '0', allocPoint = '1', secondaryReward = false, withUpdate = true;
            deposited = web3.utils.toWei('100');
            const lockPeriod = hours(36);
            const burnRate = '10000'; // 0%
            const emergencyBurnRate = '10000'; // 100%
            const depositBurnRate = 0;
            // add(uint256 _allocPoint, IBEP20 _lpToken, uint256 _burnRate, uint256 _emergencyBurnRate, uint256 _lockPeriod, uint256 _depositBurnRate, bool _withUpdate )
            await this.master.add(allocPoint, LP, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, withUpdate, {from: dev});

            const balanceOfToken1 = await this.token.balanceOf(dev);
            expect(balanceOfToken1).to.be.bignumber.equal(MINTED);

            await this.token.approve(this.master.address, deposited, {from: dev});
            const block1 = (await token.latest()).toString();
            await this.master.deposit(pid, deposited, {from: dev});
            await token.advanceBlock();
            await token.advanceBlock();
            await token.advanceBlock();
            const after = parseInt(block1) + parseInt(hours(37)); // 36 hours + 1 hour
            await token.increaseTo( after );
            await this.master.withdraw(pid, deposited, {from: dev});
            const block2 = (await token.latest()).toString();
            const poolInfo = await this.master.poolInfo(pid, {from: dev} );
            // 2 blocks only, 25% must be burned, user get 75% and no Token reward
            const balanceOfTokenLP = web3.utils.fromWei(await this.token.balanceOf(dev),'ether').toString();
            const balanceOfTokenBurned = web3.utils.fromWei(await this.token.balanceOf(DEAD_ADDR),'ether').toString();
            expect(balanceOfTokenLP).to.be.bignumber.equal('0');
            expect(balanceOfTokenBurned).to.be.bignumber.equal('100');

            // PRINCIPAL + 5 AS REWARD (we advanced block).
            const REWARDED = '105';
            const balanceOfToken = web3.utils.fromWei(await this.token.balanceOf(dev),'ether').toString();
            expect(parseFloat(balanceOfToken).toFixed(0)).to.be.equal(REWARDED);


        });


        it('DEPOSIT TOKEN / EARN TOKEN / on WITHDRAW / BRUN 25% TOKEN / AFTER LOCK', async function () {
            const pid_token = '0', deposited = web3.utils.toWei('100');
            const lockPeriod = hours(36);
            const burnRate = '2500'; // 25%
            const emergencyBurnRate = '7500'; // 75%
            const depositBurnRate = 0;
            const secondaryReward = false;
            await this.master.add('100', this.token.address, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, true, {from: dev});

            const balanceOfToken1 = await this.token.balanceOf(dev);
            expect(balanceOfToken1).to.be.bignumber.equal(MINTED);

            await this.token.approve(this.master.address, deposited, {from: dev});
            await this.master.deposit(pid_token, deposited, {from: dev});

            const block1 = (await token.latest()).toString();
            const after = parseInt(block1) + parseInt(hours(37)); // 36 hours + 1 hour
            await token.increase( after );
            await this.master.withdraw(pid_token, deposited, {from: dev});

            // 25% must be burned, user get 75% and no Token reward
            const balanceOfTokenLP = web3.utils.fromWei(await this.token.balanceOf(dev),'ether').toString();
            const balanceOfTokenBurned = web3.utils.fromWei(await this.token.balanceOf(DEAD_ADDR),'ether').toString();
            expect(balanceOfTokenLP).to.be.bignumber.equal('75');
            expect(balanceOfTokenBurned).to.be.bignumber.equal('25'); // user balance + reward

            // no token reward
            const balanceOfToken = web3.utils.fromWei(await this.token.balanceOf(dev),'ether').toString();
            const balance_plus_rewarded = web3.utils.toWei('102');
            expect(parseFloat(balanceOfToken).toFixed(0)).to.be.equal(web3.utils.fromWei(balance_plus_rewarded,'ether').toString());
        });

        it('withdraw token before - no lock period', async function () {
            const pid = '0', deposited = web3.utils.toWei('100');
            const lockPeriod = 0;
            const burnRate = '0'; // 0%
            const emergencyBurnRate = '0'; // 0%
            const depositBurnRate = 0;
            const secondaryReward = false;
            await this.master.add('100', this.LP1.address, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, true, {from: dev});

            const balanceOfToken1 = await this.token.balanceOf(dev);
            expect(balanceOfToken1).to.be.bignumber.equal(MINTED);


            await this.LP1.approve(this.master.address, deposited, {from: dev});
            await this.master.deposit(pid, deposited, {from: dev});
            await token.increase(5);
            await this.master.withdraw(pid, deposited, {from: dev});

            // 2 blocks only, 100% must be burned, user get 0% and Token reward
            const balanceOfLP = web3.utils.fromWei(await this.LP1.balanceOf(dev),'ether').toString();
            expect(balanceOfLP).to.be.bignumber.equal('100');

            // no token reward
            const tokenRewarded = web3.utils.fromWei(await this.token.balanceOf(dev),'ether').toString();
            expect('102').to.be.equal(parseFloat(tokenRewarded).toFixed(0));

            // await token.advanceBlock();
        });

        it('emergencyWithdraw - no lock period', async function () {
            const pid = '0', deposited = web3.utils.toWei('100');
            const lockPeriod = 0;
            const burnRate = '0'; // 0%
            const emergencyBurnRate = '0'; // 0%
            const depositBurnRate = 0;
            const secondaryReward = false;
            await this.master.add('100', this.LP1.address, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, true, {from: dev});

            const balanceOfToken1 = await this.token.balanceOf(dev);
            expect(balanceOfToken1).to.be.bignumber.equal(MINTED);


            await this.LP1.approve(this.master.address, deposited, {from: dev});
            await this.master.deposit(pid, deposited, {from: dev});
            await this.master.emergencyWithdraw(pid, {from: dev});

            // 2 blocks only, 100% must be burned, user get 0% and Token reward
            const balanceOfLP = web3.utils.fromWei(await this.LP1.balanceOf(dev),'ether').toString();
            const balanceOfTokenBurned = web3.utils.fromWei(await this.LP1.balanceOf(DEAD_ADDR),'ether').toString();
            expect(balanceOfLP).to.be.bignumber.equal('100');
            expect(balanceOfTokenBurned).to.be.bignumber.equal('0');

            // no token reward
            const tokenRewarded = web3.utils.fromWei(await this.token.balanceOf(dev),'ether').toString();
            expect('100').to.be.equal(parseFloat(tokenRewarded).toFixed(0));

            // await token.advanceBlock();

        });

        it('emergencyWithdraw - with lock period', async function () {
            const pid = '0', deposited = web3.utils.toWei('100');
            const lockPeriod = 3600;
            const burnRate = '25'; // 25%
            const emergencyBurnRate = '75'; // 75%
            const depositBurnRate = 0;
            const secondaryReward = false;
            await this.master.add('100', this.token.address, burnRate, emergencyBurnRate, lockPeriod, depositBurnRate, secondaryReward, true, {from: dev});

            const balanceOfToken1 = await this.token.balanceOf(dev);
            expect(balanceOfToken1).to.be.bignumber.equal(MINTED);

            await this.token.approve(this.master.address, deposited, {from: dev});
            await this.master.deposit(pid, deposited, {from: dev});
            await expectRevert(this.master.emergencyWithdraw(pid, {from: dev}),"use withdraw");

            // 2 blocks only, 100% must be burned, user get 0% and Token reward
            const balanceOfToken = web3.utils.fromWei(await this.token.balanceOf(dev),'ether').toString();
            const balanceOfTokenBurned = web3.utils.fromWei(await this.token.balanceOf(DEAD_ADDR),'ether').toString();
            expect(balanceOfToken).to.be.bignumber.equal('0');
            expect(balanceOfTokenBurned).to.be.bignumber.equal('0');

            // no token reward
            const tokenRewarded = web3.utils.fromWei(await this.token.balanceOf(dev),'ether').toString();
            expect('100').to.be.equal(parseFloat(tokenRewarded).toFixed(0));

            // await token.advanceBlock();

        });

    });



});
