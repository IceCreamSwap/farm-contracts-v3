// truffle migrate --f 3 --to 3 --network matic_testnet
// truffle migrate --f 3 --to 3 --network matic_mainnet

const Token = artifacts.require("Token");
const Farm = artifacts.require("Farm");
const TokenMinter = artifacts.require("TokenMinter");

module.exports = async function (deployer, network, accounts) {

    const dev = accounts[0];
    const getBlock = await web3.eth.getBlock("latest");
    const tax = '100'; // %10
    let feeTo = accounts[0];
    let TREASURE = accounts[0];
    const TokenPerBlock = web3.utils.toWei('0.5');
    let startBlock;

    if (network == 'mainnet') {
        startBlock = 14502500; // set block here
        feeTo = '0x0';
        TREASURE = '0x0';
    }
    if (network == 'testnet') {
        startBlock = getBlock.number;
    }
    if (network == 'dev') {
        startBlock = getBlock.number;
    }

    if( ! startBlock ){
        console.error(network, '( ! startBlock )');
        process.exit(1);
        return;
    }
    if( ! process.env.POOL_MNG ){
        console.error(network, '( ! process.env.POOL_MNG )');
        process.exit(1);
        return;
    }

    await deployer.deploy(Token, 'VanillaIce', 'Ice');
    const TOKEN_DEPLOYED = await Token.deployed();

    await deployer.deploy(TokenMinter, TOKEN_DEPLOYED.address, feeTo, tax, 'Vanilla', 'Vanilla');
    const MINTER_DEPLOYED = await TokenMinter.deployed();

    await deployer.deploy(Farm,
        TOKEN_DEPLOYED.address, MINTER_DEPLOYED.address, TREASURE,
        TokenPerBlock, startBlock);

    const FARM_DEPLOYED = await Farm.deployed();
    await TOKEN_DEPLOYED.transferOwnership(Farm.address);
    await MINTER_DEPLOYED.transferOwnership(Farm.address);

    await FARM_DEPLOYED.setMinterStatus(FARM_DEPLOYED.address, true);
    await FARM_DEPLOYED.setMinterStatus(accounts[0], false);

    console.log('Token', TOKEN_DEPLOYED.address);
    console.log('TokenMinter', MINTER_DEPLOYED.address);
    console.log('Farm', FARM_DEPLOYED.address);

    const treasure = web3.utils.toWei('1');
    await FARM_DEPLOYED.adminMint(dev, TokenPerBlock);
    await FARM_DEPLOYED.adminMint(feeTo, treasure);



    // await FARM_DEPLOYED.transferOwnership(process.env.POOL_MNG);

};
