// truffle migrate --f 3 --to 3 --network testnet
// truffle migrate --f 3 --to 3 --network mainnet
// truffle run verify Token Farm TokenMinter FaucetERC20 --network testnet
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
        startBlock; // set block here
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

    await deployer.deploy(Token, 'Vanilla', 'VANI');
    const TOKEN_DEPLOYED = await Token.deployed();

    await deployer.deploy(TokenMinter, TOKEN_DEPLOYED.address, feeTo, tax, 'VanillaShare', 'VSH');
    const MINTER_DEPLOYED = await TokenMinter.deployed();

    await deployer.deploy(Farm,
        TOKEN_DEPLOYED.address, MINTER_DEPLOYED.address, devFeeAddr,
        TokenPerBlock, startBlock, migrate_token);

    const FARM_DEPLOYED = await Farm.deployed();
    await MINTER_DEPLOYED.transferOwnership(Farm.address);

    await TOKEN_DEPLOYED.setAuthorizedMintCaller(MINTER_DEPLOYED.address);
    await TOKEN_DEPLOYED.setAuthorizedMintCaller(accounts[0]);

    console.log('Token', TOKEN_DEPLOYED.address);
    console.log('TokenMinter', MINTER_DEPLOYED.address);
    console.log('Farm', FARM_DEPLOYED.address);

    const LIQUIDITY = web3.utils.toWei('1');
    await TOKEN_DEPLOYED.mintUnlockedToken(dev, TokenPerBlock); // to test pools
    await TOKEN_DEPLOYED.mintUnlockedToken(feeTo, LIQUIDITY); // any liquidity to lock



    // await FARM_DEPLOYED.transferOwnership(process.env.POOL_MNG);

};
