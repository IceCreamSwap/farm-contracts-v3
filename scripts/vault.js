// truffle exec scripts\vault.js --network matic_testnet
const Vault = artifacts.require("Vault");
module.exports = async function (deployer) {
    try {
        router = await Vault.at('0x0');
        const token = await router.token();
        const receiptToken = await router.receiptToken();
        const masterchef = await router.masterchef();
        const totalShares = await router.totalShares();
        console.log('token', token);
        console.log('receiptToken', receiptToken);
        console.log('masterchef', masterchef);
        console.log('totalShares', totalShares);
    } catch (e) {
        console.error(e.toString());
    }
    process.exit(0);
};
