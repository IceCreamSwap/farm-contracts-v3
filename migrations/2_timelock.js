// truffle migrate --f 2 --to 2 --network matic_testnet
// truffle migrate --f 2 --to 2 --network matic_mainnet
const Timelock = artifacts.require("Timelock");
module.exports = function(deployer, network, accounts) {
    let delay = 60;
    const admin = accounts[0];
    console.log(network, 'admin', admin);
    if (network == 'bsc') {
        delay = 86400;
    }
    deployer.deploy(Timelock, delay, admin);
};
