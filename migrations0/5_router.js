// truffle migrate --f 5 --to 5 --network testnet
// truffle migrate --f 5 --to 5 --network mainnet
// truffle run verify UniswapV2Router02 --network mainnet
// npx truffle-flattener UniswapV2Router02.sol > UniswapV2Router02.txt

const UniswapV2Router02 = artifacts.require('UniswapV2Router02');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const _WBNB = artifacts.require('WBNB');
module.exports = async function (deployer, network, accounts) {
    let WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    if (network == 'dev') {
        await deployer.deploy(_WBNB);
        const _weth = await _WBNB.deployed();
        WBNB = _weth.address;
    } else if (network == 'testnet') {
        WBNB = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd';
    }
    const _factory = await UniswapV2Factory.deployed();
    await deployer.deploy(UniswapV2Router02, _factory.address, WBNB);
    const router = await UniswapV2Router02.deployed();
    console.log(UniswapV2Router02.address, _factory.address, WBNB);
};
