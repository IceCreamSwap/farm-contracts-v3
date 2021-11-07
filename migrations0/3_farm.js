require('dotenv').config()
// truffle migrate --f 3 --to 3 --network testnet && truffle run verify MasterChef Token --network testnet
const MasterChef = artifacts.require("FarmVault");
const FaucetERC20 = artifacts.require("MockBEP20");
const Token = artifacts.require("Token");
const CakeToken = artifacts.require("CakeToken");
const SyrupBar = artifacts.require("SyrupBar");
const MockMasterChef = artifacts.require("MockMasterChef");
let TOKEN_MASTER_DEPLOYED;
module.exports = async function (deployer, network, accounts) {
    await deploy_token(deployer, network, accounts);
};

async function deploy_token(deployer, network, accounts) {
    let tokenPerBlock;
    const block = await web3.eth.getBlock("latest");
    let startBlock;
    let devaddr;
    const _taxTo = accounts[0];
    const _tax = 0;
    let router;
    // let cake;
    let mc;

    const wbnb = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    const busd = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
    const usdt = '0x55d398326f99059fF775485246999027B3197955';
    const cake = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
    const eth =  '0x2170Ed0880ac9A755fd29B2688956BD959F933F8';
    const btcb = '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c';
    const usdc = '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d';


    if (network == 'mainnet') {
        router = '0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F';
    }
    if (network == 'testnet') {
        router = '0xf946634f04aa0eD1b935C8B876a0FD535F993D43';
        tokenPerBlock = web3.utils.toWei('1');
        devaddr = accounts[0];
        startBlock = block.number;
        // cake = '0x12c701256bDE096E0dE36a252395F25a077A2E1b';
        mc = '0x00b4c3AeCcA7c492a45A53af306B69BA35D20847';
    }

    if (network == 'dev') {
        tokenPerBlock = web3.utils.toWei('1');
        devaddr = accounts[0];
        startBlock = block.number;

        // await deployer.deploy(FaucetERC20, "Test", "Test", tokenPerBlock);
        await deployer.deploy(CakeToken);
        const TOKEN_DEPLOYED = await CakeToken.deployed();

        await deployer.deploy(SyrupBar, TOKEN_DEPLOYED.address);
        const SYRUP_DEPLOYED = await SyrupBar.deployed();

        await deployer.deploy(MockMasterChef,
            TOKEN_DEPLOYED.address,
            SYRUP_DEPLOYED.address,
            devaddr, tokenPerBlock, startBlock);

        const FARM_DEPLOYED = await MockMasterChef.deployed();
        await TOKEN_DEPLOYED.transferOwnership(SYRUP_DEPLOYED.address);
        await SYRUP_DEPLOYED.transferOwnership(FARM_DEPLOYED.address);

        // cake = TOKEN_DEPLOYED.address;
        mc = FARM_DEPLOYED.address;
    }
    if (!startBlock && network != 'dev') {
        console.log('NO START BLOCK!');
        process.exit(1);
    }
    if (!devaddr) {
        console.log('NO devaddr!');
        process.exit(1);
    }
    if (!cake || !mc) {
        console.log('(!cake||!mc)');
        process.exit(1);
    }
    await deployer.deploy(Token, _taxTo, _tax);
    const TOKEN_TOKEN = await Token.deployed();
    if (network != 'dev') {
        await TOKEN_TOKEN.init_router(router);
    }
    const token = TOKEN_TOKEN.address;
    await deployer.deploy(
        MasterChef,
        token,
        startBlock,
        mc, cake);
    await TOKEN_TOKEN.mintUnlockedToken(devaddr, tokenPerBlock);
    TOKEN_MASTER_DEPLOYED = await MasterChef.deployed();
    await TOKEN_TOKEN.setAuthorizeMintCaller(TOKEN_MASTER_DEPLOYED.address, true);
}
