// truffle migrate --f 9 --to 9 --network matic_testnet
// truffle migrate --f 9 --to 9 --network matic_mainnet

const Token = artifacts.require("Token");
const Farm = artifacts.require("Farm");
const TokenMinter = artifacts.require("TokenMinter");
const Vault = artifacts.require("Vault");

module.exports = async function (deployer, network, accounts) {
    let admin = accounts[0];
    let treasury = accounts[0];

    if (network == 'mainnet') {
        treasury = address[0];
    }

    const TOKEN_DEPLOYED = await Token.deployed();
    const MINTER_DEPLOYED = await TokenMinter.deployed();
    const FARM_DEPLOYED = await Farm.deployed();
    // await FARM_DEPLOYED.setMinterStatus(FARM_DEPLOYED.address, true);

    const token = TOKEN_DEPLOYED.address;
    const receiptToken = MINTER_DEPLOYED.address;
    const masterchef = FARM_DEPLOYED.address;

    console.log('Token', TOKEN_DEPLOYED.address);
    console.log('TokenMinter', MINTER_DEPLOYED.address);
    console.log('Farm', FARM_DEPLOYED.address);

    await deployer.deploy(Vault, token, receiptToken, masterchef, admin, treasury);

    const VAULT_DEPLOYED = await Vault.deployed();
    await FARM_DEPLOYED.adminSetContractStatus(VAULT_DEPLOYED.address, true);
    await FARM_DEPLOYED.adminSetWhiteList(VAULT_DEPLOYED.address, true);


};
