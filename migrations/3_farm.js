// truffle migrate --f 3 --to 3 --network matic_testnet
// truffle migrate --f 3 --to 3 --network matic_mainnet

const Token = artifacts.require("Token");
const Farm = artifacts.require("Farm");
const TokenMinter = artifacts.require("TokenMinter");
const FaucetERC20 = artifacts.require("FaucetERC20");

module.exports = async function (deployer, network, accounts) {

    const dev = accounts[0];
    const getBlock = await web3.eth.getBlock("latest");
    const tax = '100'; // %10
    let feeTo = accounts[0];
    let devFeeAddr = accounts[0];
    const TokenPerBlock = web3.utils.toWei('0.5');
    let startBlock;
    let migrate_token;
    if (network == 'mainnet') {
        startBlock = 14502500; // set block here
        feeTo = '';
        devFeeAddr = '';
        migrate_token = '';
    }
    if (network == 'testnet') {
        const MINTED = web3.utils.toWei('100');
        startBlock = getBlock.number;
        await deployer.deploy(FaucetERC20, 'Old', 'Old', MINTED);
        const OLD_DEPLOYED = await FaucetERC20.deployed();
        migrate_token = OLD_DEPLOYED.address;
    }
    if (network == 'dev') {
        const MINTED = web3.utils.toWei('100');
        startBlock = getBlock.number;
        await deployer.deploy(FaucetERC20, 'Old', 'Old', MINTED);
        const OLD_DEPLOYED = await FaucetERC20.deployed();
        migrate_token = OLD_DEPLOYED.address;
    }

    if( ! startBlock ){
        console.error(network, '( ! startBlock )');
        process.exit(1);
        return;
    }
    if( ! migrate_token || ! feeTo || ! devFeeAddr ){
        console.error(network, '( ! migrate_token || ! feeTo || ! devFeeAddr )');
        process.exit(1);
        return;
    }

    await deployer.deploy(Token, 'VanillaIce', 'Ice');
    const TOKEN_DEPLOYED = await Token.deployed();

    await deployer.deploy(TokenMinter, TOKEN_DEPLOYED.address, feeTo, tax, 'Vanilla', 'Vanilla');
    const MINTER_DEPLOYED = await TokenMinter.deployed();

    await deployer.deploy(Farm,
        TOKEN_DEPLOYED.address, MINTER_DEPLOYED.address, devFeeAddr,
        TokenPerBlock, startBlock, migrate_token);

    const FARM_DEPLOYED = await Farm.deployed();
    await TOKEN_DEPLOYED.transferOwnership(Farm.address);
    await MINTER_DEPLOYED.transferOwnership(Farm.address);

    await FARM_DEPLOYED.adminSetMinterStatus(FARM_DEPLOYED.address, true);
    await FARM_DEPLOYED.adminSetMinterStatus(accounts[0], false);

    console.log('Token', TOKEN_DEPLOYED.address);
    console.log('TokenMinter', MINTER_DEPLOYED.address);
    console.log('Farm', FARM_DEPLOYED.address);

    const LIQUIDITY = web3.utils.toWei('1');
    await FARM_DEPLOYED.adminMint(dev, TokenPerBlock); // to test pools
    await FARM_DEPLOYED.adminMint(feeTo, LIQUIDITY); // any liquidity to lock



    // await FARM_DEPLOYED.transferOwnership(process.env.POOL_MNG);

};
