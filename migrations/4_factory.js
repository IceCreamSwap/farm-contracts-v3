// truffle migrate --f 4 --to 4 --network testnet
// truffle migrate --f 4 --to 4 --network mainnet
// truffle run verify UniswapV2Factory --network mainnet
// truffle-flattener UniswapV2Factory.sol > UniswapV2Factory.txt

const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Pair = artifacts.require('UniswapV2Pair');
module.exports = async function (deployer, network, accounts) {
    if (!process.env.SWAP_FEE) {
        console.error('!process.env.SWAP_FEE');
        procees.exit(1);
    }
    await deployer.deploy(UniswapV2Factory);
    const _factory = await UniswapV2Factory.deployed();
    console.log(network, 'FACTORY_ADDRESS', _factory.address);
    await _factory.setFeeTo(process.env.SWAP_FEE);
    await _factory.setFeeToSetter(process.env.SWAP_FEE);
    const r = await _factory.pairCodeHash();
    const pairCodeHash = await _factory.pairCodeHash();
    console.log('INIT_CODE_HASH local:', r);
    console.log('INIT_CODE_HASH:', pairCodeHash);

};
