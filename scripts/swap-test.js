const UniswapV2Router02 = artifacts.require("UniswapV2Router02");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const UniswapV2Pair = artifacts.require("UniswapV2Pair");
const UniswapV2Library = artifacts.require("UniswapV2Library");
const ROUTER = '0x0';
const dev = '0x0';
let router, factory;
const k10 = '10000000000000000000000';
function ensure(hours) {
    return parseInt((new Date().getTime() + (60 * 60 * hours * 1000)) / 1000);
}

async function addLiquidity(deployer) {
    const tokenA = '0x0';
    const tokenB = '0x0';
    const amountADesired = '1000000000000000000';
    const amountBDesired = '1000000000000000000';
    const amountAMin = '1000000000000000000';
    const amountBMin = '1000000000000000000';
    const to = '0x0';
    const deadline = ensure(1);
    // const pair = await UniswapV2Pair.at(token);
    // await pair.approve(ROUTER, k10);
    await router.addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline);

}

async function getHash(factory_addr) {
    factory = await UniswapV2Factory.at(factory_addr);
    const INIT_CODE_HASH = await factory.pairCodeHash();
    const feeToSetter = await factory.feeToSetter();
    console.log('INIT_CODE_HASH:', INIT_CODE_HASH);
    console.log('feeToSetter:', feeToSetter);
}
module.exports = async function (deployer) {
    try {
        router = await UniswapV2Router02.at('0x0');
        const factory_addr = await router.factory();
        factory = await UniswapV2Factory.at(factory_addr);
        await pairs();
    } catch (e) {
        console.error(e.toString());
    }
    process.exit(0);
};
async function pairs(){
    const allPairsLength = await factory.allPairsLength();
    for( let i = 0 ; i < allPairsLength; i ++ ){
        const pair = await factory.allPairs(i);
        const lp_ctx = new web3.eth.Contract(require('./abi/UniswapV2Pair.json'), pair);
        const token0_addr = await lp_ctx.methods.token0().call();
        const token1_addr = await lp_ctx.methods.token1().call();
        const token0_ctx = new web3.eth.Contract(require('./abi/BEP20_ABI.json'), token0_addr);
        const token1_ctx = new web3.eth.Contract(require('./abi/BEP20_ABI.json'), token1_addr);
        const token0_symbol = await token0_ctx.methods.symbol().call();
        const token1_symbol = await token1_ctx.methods.symbol().call();
        const detected_pair_name = token0_symbol + "-" + token1_symbol;
        // const balance = await lp_ctx.methods.token0().call();;
        console.log(pair, detected_pair_name);
        // template_add(pair, detected_pair_name);

    }
}
function template_add( addr, name ){
    const points = '1000';
    const fee = '0';
    console.log(`await add_lp('${name}', ${points}, '${addr}', ${fee});`);
}
async function balanceOf( token, addr ){
    const lp_ctx = new web3.eth.Contract(require('./abi/UniswapV2Pair.json'), token);
    const token0_addr = await lp_ctx.methods.token0().call();
    const token1_addr = await lp_ctx.methods.token1().call();
    const token0_ctx = new web3.eth.Contract(require('./abi/BEP20_ABI.json'), token0_addr);
    const token1_ctx = new web3.eth.Contract(require('./abi/BEP20_ABI.json'), token1_addr);
    const token0_symbol = await token0_ctx.methods.symbol().call();
    const token1_symbol = await token1_ctx.methods.symbol().call();
    const detected_pair_name = token0_symbol + "-" + token1_symbol;
    console.log(' - ', detected_pair_name);
    console.log(' - token0 ', token0_addr, token0_symbol);
    console.log(' - token1 ', token1_addr, token1_symbol);
    const balanceOf = await lp_ctx.methods.balanceOf(addr).call();
    console.log(' - balanceOf ', addr, balanceOf.toString());
}
