const chalk = require('chalk');
const {accounts, contract} = require('@openzeppelin/test-environment');
const {BN, expectRevert, time, expectEvent, constants} = require('@openzeppelin/test-helpers');
const {expect} = require('chai');
const FaucetERC20 = contract.fromArtifact('FaucetERC20');
const MockMasterChef = contract.fromArtifact('MockMasterChef');
const CakeToken = contract.fromArtifact('CakeToken');
const SyrupBar = contract.fromArtifact('SyrupBar');
const Token = contract.fromArtifact('Token');
const Farm = contract.fromArtifact('Farm');
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
const mintAmount = '100';
const MINTED = toWei(mintAmount);
const DEAD_ADDR = '0x000000000000000000000000000000000000dEaD';
let dev, user, feeAddress, reserve;
const ONE = toWei('1');
const TWO = toWei('2');
const CEM = toWei('100');
const DUZENTOS = toWei('200');
const QUINHENTOS = toWei('500');

describe('Bank', async function () {
    beforeEach(async function () {
        this.timeout(60000);
        dev = accounts[0];
        user = accounts[1];

        this.CAKE = await CakeToken.new({from: dev});
        this.TOKEN = await Token.new('Token','Token', {from: dev});
        this.BUSD = await FaucetERC20.new("BUSD", "BUSD", MINTED, {from: dev});
        this.OLD = await FaucetERC20.new("Old", "Old", MINTED, {from: dev});
        this.syrup = await SyrupBar.new(this.TOKEN.address, {from: dev});
        this.mc = await MockMasterChef.new(this.CAKE.address, this.syrup.address, dev, tokenPerBlock, 0, {from: dev});
        this.farm = await Farm.new(this.TOKEN.address, 0, this.mc.address, this.CAKE.address, {from: dev});

        await this.TOKEN.mintUnlockedToken(dev, MINTED, {from: dev});
        await this.CAKE.mint(dev, MINTED, {from: dev});

        this.weth = await WBNB.new({from: dev});
        this.factory = await UniswapV2Factory.new({from: dev});
        this.router = await UniswapV2Router02.new(this.factory.address, this.weth.address,{from: dev});

        await this.factory.createPair(this.weth.address, this.CAKE.address);
        await this.factory.createPair(this.weth.address, this.TOKEN.address);
        await this.factory.createPair(this.weth.address, this.BUSD.address);
        await this.factory.createPair(this.weth.address, this.OLD.address);

        this.WETH_CAKE_PAIR = await this.factory.getPair(this.weth.address, this.CAKE.address);
        this.WETH_BUSD_PAIR = await this.factory.getPair(this.weth.address, this.BUSD.address);
        this.WETH_TOKEN_PAIR = await this.factory.getPair(this.weth.address, this.TOKEN.address);
        this.WETH_OLD_PAIR = await this.factory.getPair(this.weth.address, this.OLD.address);

        this.WETHCAKE = await IUniswapV2Pair.at(this.WETH_CAKE_PAIR);
        this.WETHBUSD = await IUniswapV2Pair.at(this.WETH_BUSD_PAIR);
        this.WETHTOKEN = await IUniswapV2Pair.at(this.WETH_TOKEN_PAIR);
        this.WETHOLD = await IUniswapV2Pair.at(this.WETH_OLD_PAIR);

        await this.CAKE.approve(this.router.address, MINTED, {from: dev});
        await this.TOKEN.approve(this.router.address, MINTED, {from: dev});
        await this.BUSD.approve(this.router.address, MINTED, {from: dev});
        await this.OLD.approve(this.router.address, MINTED, {from: dev});


    });
    describe('Farm', async function () {

        it('basic security', async function () {
            this.timeout(60000);
            await this.farm.updateTokenPerBlock(tokenPerBlock, {from: dev});
            await this.farm.updateMultiplier(1, {from: dev});
            // await this.router.addLiquidity(this.BUSD.address, this.token.address, QUINHENTOS, QUINHENTOS, 0, 0, dev, now() + 60, {from: dev});
            // await this.router.addLiquidityETH(this.T1.address, ONE, ONE, ONE, dev, now() + 60, {from: dev, value: ONE});
            // await this.router.addLiquidityETH(this.token.address, ONE, ONE, ONE, dev, now() + 60, {from: dev, value: ONE});
            // await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(ONE, 0, [this.token.address, this.BUSD.address], reserve, n2, {from: user});
        });

    });


});
