const TIMELOCK = artifacts.require("Timelock");
const ethers = require('ethers');
let cli, master;

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

function get_interval(hours) {
    return parseInt((new Date().getTime() + (60 * 60 * hours * 1000)) / 1000);
}

async function updateTokenPerBlock(cli, target, eta, run, TokensPerBlock ) {
    let tx;
    const value = 0; // timelock
    const signature = 'updateTokenPerBlock(uint256)';
    const data = encodeParameters(['uint256'], [TokensPerBlock]);
    console.log('target', target);
    console.log('value', value);
    console.log('signature', signature);
    console.log('data', data);
    console.log('eta', eta); //

    if( run )
        tx = await cli.executeTransaction(target, value, signature, data, eta);
    else
        tx = await cli.queueTransaction(target, value, signature, data, eta);
    console.log('tx', tx.tx);
}

async function setLock(cli, target, eta, run ) {
    let tx;
    const value = 0; // timelock
    const signature = 'setLock()';
    const data = encodeParameters([], []);
    console.log('target', target);
    console.log('value', value);
    console.log('signature', signature);
    console.log('data', data);
    console.log('eta', eta); //

    if( run )
        tx = await cli.executeTransaction(target, value, signature, data, eta);
    else
        tx = await cli.queueTransaction(target, value, signature, data, eta);
    console.log('tx', tx.tx);
}

async function set(run, eta, pid, point, fee) {
    let tx;
    const value = 0;
    const signature = 'set(uint256,uint256,uint16,bool)';
    const params = [pid, point, fee, true];
    console.log('pid', pid, signature, fee, params);
    const data = encodeParameters(['uint256', 'uint256', 'uint16', 'bool'], params);

    try {
        if (run)
            tx = await cli.executeTransaction(master, value, signature, data, eta);
        else
            tx = await cli.queueTransaction(master, value, signature, data, eta);
        console.log('- tx', tx.tx);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}

async function add(run, eta, pid, point, fee) {
    let tx;
    const value = 0;
    const signature = 'add(uint256,uint256,uint16,bool)';
    const params = [pid, point, fee, true];
    console.log('pid', pid, signature, fee, params);
    const data = encodeParameters(['uint256', 'uint256', 'uint16', 'bool'], params);

    try {
        if (run)
            tx = await cli.executeTransaction(master, value, signature, data, eta);
        else
            tx = await cli.queueTransaction(master, value, signature, data, eta);
        console.log('- tx', tx.tx);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}

module.exports = async function (deployer) {
    master = '0x0';
    const timelock = '0x0'; // new
    // return console.log( get_interval(25) );
    try {
        cli = await TIMELOCK.at(timelock);
        const eta = '1621791153'; // set the timestamp here > 24 hours
        const run = false; // set to true to execute same tx bellow
        // await set(run, eta, '1', '3000', '0');
    } catch (e) {
        console.log("[ERROR]", e.toString());
    }
    process.exit(0);
};
