const chalk = require('chalk');
const {accounts, contract} = require('@openzeppelin/test-environment');
const {BN, expectRevert, time, expectEvent, constants} = require('@openzeppelin/test-helpers');
const {expect} = require('chai');
const MockBEP20 = contract.fromArtifact('MockBEP20');
const MockMasterChef = contract.fromArtifact('MockMasterChef');
const CakeToken = contract.fromArtifact('CakeToken');
const SyrupBar = contract.fromArtifact('SyrupBar');
const Token = contract.fromArtifact('Token');
const FarmVault = contract.fromArtifact('FarmVault');
const WBNB = contract.fromArtifact("WBNB");
const IUniswapV2Pair = contract.fromArtifact("IUniswapV2Pair");
const UniswapV2Factory = contract.fromArtifact("UniswapV2Factory");
const UniswapV2Router02 = contract.fromArtifact("UniswapV2Router02");
const numeral = require('numeral');

let yellowBright = chalk.yellowBright;
let magenta = chalk.magenta;
let cyan = chalk.cyan;
let yellow = chalk.yellow;
let red = chalk.red;
let blue = chalk.blue;

function now() {
    return parseInt((new Date().getTime()) / 1000);
}

function hours(total) {
    return parseInt(60 * 60 * total);
}

function fromWei(v) {
    return web3.utils.fromWei(v, 'ether').toString();
}

function fromGwei(v) {
    return web3.utils.fromWei(v, 'gwei').toString();
}

function d(v) {
    return numeral(v.toString()).format('0,0');
}

function toWei(v) {
    return web3.utils.toWei(v).toString();
}

function date(ts) {
    const pad = (n, s = 2) => (`${new Array(s).fill(0)}${n}`).slice(-s);
    const d = new Date(ts * 1000);
    return red(`${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
}

const tokenPerBlock = web3.utils.toWei('1');

const ONE = toWei('1');
const TWO = toWei('2');
const CEM = toWei('100');
const DUZENTOS = toWei('200');
const QUINHENTOS = toWei('500');
const mintAmount = toWei('1000');
const MINTED = mintAmount;
const DEAD_ADDR = '0x000000000000000000000000000000000000dEaD';
let dev, user, feeAddress, reserve;

describe('Bank', async function () {
    beforeEach(async function () {
        this.timeout(60000);
        dev = accounts[0];
        user = accounts[1];

        this.CAKE = await CakeToken.new({from: dev});
        this.TOKEN = await Token.new('Token', 'Token', {from: dev});
        this.BUSD = await MockBEP20.new("BUSD", "BUSD", MINTED, 18, {from: dev});
        this.USDT = await MockBEP20.new("USDT", "USDT", MINTED, 6, {from: dev});
        this.ETH = await MockBEP20.new("ETH", "ETH", MINTED, 18, {from: dev});
        this.BTCB = await MockBEP20.new("BTCB", "BTCB", MINTED, 6, {from: dev});
        this.USDC = await MockBEP20.new("USDC", "USDC", MINTED, 6, {from: dev});
        this.OLD = await MockBEP20.new("Old", "Old", MINTED, 18, {from: dev});
        this.syrup = await SyrupBar.new(this.TOKEN.address, {from: dev});
        this.mc = await MockMasterChef.new(this.CAKE.address, this.syrup.address, dev, tokenPerBlock, 0, {from: dev});

        this.weth = await WBNB.new({from: dev});
        this.factory = await UniswapV2Factory.new({from: dev});
        this.router = await UniswapV2Router02.new(this.factory.address, this.weth.address, {from: dev});

        this.farm = await FarmVault.new(this.TOKEN.address, 0, this.mc.address, this.CAKE.address,
            this.router.address, this.factory.address, {from: dev});

        await this.TOKEN.setAuthorizeMintCaller(this.farm.address, true, {from: dev});
        await this.TOKEN.mintUnlockedToken(dev, DUZENTOS, {from: dev});
        await this.CAKE.mint(dev, MINTED, {from: dev});

        // console.log('pairCodeHash', (await this.factory.pairCodeHash() ));
        await this.factory.createPair(this.weth.address, this.CAKE.address, {from: dev});
        await this.factory.createPair(this.weth.address, this.TOKEN.address, {from: dev});
        await this.factory.createPair(this.weth.address, this.BUSD.address, {from: dev});
        await this.factory.createPair(this.weth.address, this.USDT.address, {from: dev});
        await this.factory.createPair(this.BUSD.address, this.USDT.address, {from: dev});
        await this.factory.createPair(this.weth.address, this.OLD.address, {from: dev});

        this.WETH_CAKE_PAIR = await this.factory.getPair(this.weth.address, this.CAKE.address, {from: dev});
        this.WETH_BUSD_PAIR = await this.factory.getPair(this.weth.address, this.BUSD.address, {from: dev});
        this.WETH_TOKEN_PAIR = await this.factory.getPair(this.weth.address, this.TOKEN.address, {from: dev});
        this.WETH_OLD_PAIR = await this.factory.getPair(this.weth.address, this.OLD.address, {from: dev});
        this.WETH_USDT_PAIR = await this.factory.getPair(this.weth.address, this.USDT.address, {from: dev});
        this.BUSD_USDT_PAIR = await this.factory.getPair(this.BUSD.address, this.USDT.address, {from: dev});

        this.WETHCAKE = await IUniswapV2Pair.at(this.WETH_CAKE_PAIR);
        this.WETHBUSD = await IUniswapV2Pair.at(this.WETH_BUSD_PAIR);
        this.WETHTOKEN = await IUniswapV2Pair.at(this.WETH_TOKEN_PAIR);
        this.WETHOLD = await IUniswapV2Pair.at(this.WETH_OLD_PAIR);
        this.WETHUSDT = await IUniswapV2Pair.at(this.WETH_USDT_PAIR);
        this.BUSDUSDT = await IUniswapV2Pair.at(this.BUSD_USDT_PAIR);

        await this.CAKE.approve(this.router.address, MINTED, {from: dev});
        await this.TOKEN.approve(this.router.address, MINTED, {from: dev});
        await this.BUSD.approve(this.router.address, MINTED, {from: dev});
        await this.OLD.approve(this.router.address, MINTED, {from: dev});
        await this.USDT.approve(this.router.address, MINTED, {from: dev});


    });
    describe('Farm', async function () {

        it('test emission', async function () {
            this.timeout(60000);
            await this.farm.add('1', this.token.address, 0, 0, 0, 0, 0, true, 0, 0, {from: dev});
            const poolLength = parseInt((await this.farm.poolLength()).toString());
            console.log('tokenPerBlock', fromWei(await this.farm.tokenPerBlock()) );
            console.log('poolLength', poolLength);
            for (let pid = 0; pid < poolLength; pid++) {
                const poolInfo = await this.farm.poolInfo(pid);
                const lpToken = poolInfo.lpToken;
                const cake_pid = poolInfo.cake_pid;
                const lp = await IUniswapV2Pair.at(lpToken);
                const symbol = await lp.symbol();
                if (symbol == "VLPv1") {
                    const token0 = await lp.token0();
                    const token1 = await lp.token1();
                    const lp0 = await IUniswapV2Pair.at(token0);
                    const lp1 = await IUniswapV2Pair.at(token1);
                    const symbol0 = await lp0.symbol();
                    const symbol1 = await lp1.symbol();
                    console.log(pid + '> ' + symbol0 + "/" + symbol1 + " cake_pid=" + cake_pid);
                } else {
                    console.log(pid + '> ' + symbol + " cake_pid=" + cake_pid);
                }
            }
            let balanceOf = await this.TOKEN.balanceOf(dev);
            expect(fromWei(balanceOf)).to.be.equal('198');
            await this.TOKEN.approve(this.farm.address, TWO, {from: dev});
            await this.farm.deposit('0', ONE, {from: dev});
            await this.farm.deposit('0', ONE, {from: dev});

            balanceOf = await this.TOKEN.balanceOf(dev);
            expect(fromWei(balanceOf)).to.be.equal('196.000222222222222222');

            await this.farm.withdraw(0, TWO, {from: dev});

            balanceOf = await this.TOKEN.balanceOf(dev);
            expect(fromWei(balanceOf)).to.be.equal('198.000444444444444444');


            // await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(ONE, 0, [this.token.address, this.BUSD.address], reserve, n2, {from: user});
        });



        /**
        it('setup', async function () {
            this.timeout(60000);
            // cake
            await this.router.addLiquidity(this.BUSD.address, this.CAKE.address, ONE, ONE, 0, 0, dev, now() + 60, {from: dev});
            await this.router.addLiquidityETH(this.CAKE.address, ONE, ONE, ONE, dev, now() + 60, {
                from: dev,
                value: ONE
            });
            await this.router.addLiquidityETH(this.BUSD.address, ONE, ONE, ONE, dev, now() + 60, {
                from: dev,
                value: ONE
            });

            // token
            await this.router.addLiquidityETH(this.TOKEN.address, ONE, ONE, ONE, dev, now() + 60, {
                from: dev,
                value: ONE
            });
            await this.router.addLiquidity(this.BUSD.address, this.TOKEN.address, ONE, ONE, 0, 0, dev, now() + 60, {from: dev});
            await this.router.addLiquidityETH(this.OLD.address, ONE, ONE, ONE, dev, now() + 60, {
                from: dev,
                value: ONE
            });

            await this.mc.add(10000, this.CAKE.address, true, {from: dev});
            await this.mc.add(10000, this.WETHCAKE.address, true, {from: dev});
            await this.mc.add(1000, this.WETHBUSD.address, true, {from: dev});
            await this.mc.add(500, this.BUSD.address, true, {from: dev});

            await this.farm.contract_init1(this.weth.address, this.BUSD.address, this.USDT.address, this.CAKE.address, this.ETH.address, this.BTCB.address, this.USDC.address, {from: dev});
            await this.farm.contract_init2(this.weth.address, this.BUSD.address, this.USDT.address, this.CAKE.address, this.ETH.address, this.BTCB.address, this.USDC.address, {from: dev});
            await this.farm.contract_init3(this.weth.address, this.BUSD.address, this.USDT.address, this.CAKE.address, this.ETH.address, this.BTCB.address, this.USDC.address, {from: dev});

            const poolLength = parseInt((await this.farm.poolLength()).toString());
            console.log('poolLength', poolLength);
            for (let pid = 0; pid < poolLength; pid++) {
                const poolInfo = await this.farm.poolInfo(pid);
                const lpToken = poolInfo.lpToken;
                const allocPoint = poolInfo.allocPoint.toString();
                const taxWithdraw = poolInfo.taxWithdraw;
                const taxWithdrawBeforeLock = poolInfo.taxWithdrawBeforeLock;
                const withdrawLockPeriod = poolInfo.withdrawLockPeriod;
                const lock = poolInfo.lock;
                const depositFee = poolInfo.depositFee;
                const cake_pid = poolInfo.cake_pid;
                const lp = await IUniswapV2Pair.at(lpToken);
                const symbol = await lp.symbol();
                if (symbol == "VLPv1") {
                    const token0 = await lp.token0();
                    const token1 = await lp.token1();
                    const lp0 = await IUniswapV2Pair.at(token0);
                    const lp1 = await IUniswapV2Pair.at(token1);
                    const symbol0 = await lp0.symbol();
                    const symbol1 = await lp1.symbol();
                    console.log(pid + '> ' + symbol0 + "/" + symbol1 + " cake_pid=" + cake_pid);
                } else {
                    console.log(pid + '> ' + symbol + " cake_pid=" + cake_pid);
                }
            }
            let balanceOf = await this.TOKEN.balanceOf(dev);
            expect(fromWei(balanceOf)).to.be.equal('198');
            await this.TOKEN.approve(this.farm.address, TWO, {from: dev});
            await this.farm.deposit('0', ONE, {from: dev});
            await this.farm.deposit('0', ONE, {from: dev});

            balanceOf = await this.TOKEN.balanceOf(dev);
            expect(fromWei(balanceOf)).to.be.equal('196.000222222222222222');

            await this.farm.withdraw(0, TWO, {from: dev});

            balanceOf = await this.TOKEN.balanceOf(dev);
            expect(fromWei(balanceOf)).to.be.equal('198.000444444444444444');


            // await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(ONE, 0, [this.token.address, this.BUSD.address], reserve, n2, {from: user});
        });
        */

        /*
        it('basic security', async function () {
            this.timeout(60000);
            await this.farm.updateTokenPerBlock(tokenPerBlock, {from: dev});
            await this.farm.updateMultiplier(1, {from: dev});
            // await this.router.addLiquidity(this.BUSD.address, this.token.address, QUINHENTOS, QUINHENTOS, 0, 0, dev, now() + 60, {from: dev});
            // await this.router.addLiquidityETH(this.T1.address, ONE, ONE, ONE, dev, now() + 60, {from: dev, value: ONE});
            // await this.router.addLiquidityETH(this.token.address, ONE, ONE, ONE, dev, now() + 60, {from: dev, value: ONE});
            // await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(ONE, 0, [this.token.address, this.BUSD.address], reserve, n2, {from: user});
        });
        */

        /*
        it('just deposit and withdraw token', async function () {
            this.timeout(60000);
            await this.TOKEN.approve(this.farm.address, MINTED, {from: dev});
            await this.farm.add(1, this.TOKEN.address, 0, 0, 0, 0, 0, true, 0, 0, {from: dev});
            const poolLength = (await this.farm.poolLength()).toString();
            expect( poolLength ).to.be.equal('1');

            let balanceOf = await this.TOKEN.balanceOf(dev);
            expect( balanceOf ).to.be.bignumber.equal( DUZENTOS );
            await this.farm.deposit('0', CEM, {from: dev});
            await this.farm.deposit('0', CEM, {from: dev});

            balanceOf = await this.TOKEN.balanceOf(dev);
            expect( fromWei(balanceOf) ).to.be.equal( '0.102' );

            await this.farm.withdraw(0, DUZENTOS, {from: dev});

            balanceOf = await this.TOKEN.balanceOf(dev);
            expect( fromWei(balanceOf) ).to.be.equal( '200.204' );
        });
        */


    });


});
