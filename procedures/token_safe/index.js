var { VOID_ETHEREUM_ADDRESS, abi, VOID_BYTES32, blockchainCall, sendBlockchainTransaction, numberToString, compile, sendAsync, deployContract, abi, MAX_UINT256, web3Utils, fromDecimals, toDecimals } = global.multiverse = require('@ethereansos/multiverse');

var additionalData = { from : web3.currentProvider.knowledgeBase.from };

var tokenSafe;

module.exports = async function start() {
    var totalSupply = "47000000000";
    var burnWallet = VOID_ETHEREUM_ADDRESS;
    var taxWallet = "0x94845333028B1204Fbe14E1278Fd4Adde46B22ce";
    var _owner = web3.currentProvider.knowledgeBase.fromAddress;
    var _sourceTokenAddress = process.env.SOURCE_TOKEN_ADDRESS || VOID_ETHEREUM_ADDRESS;
    var _destinations = [burnWallet, taxWallet, burnWallet, taxWallet];
    var _destinationAmounts = [1, 0.5, 4, 5].map(it => it / 100).map(it => it * parseInt(totalSupply)).map(it => numberToString(it).split('.')[0]).map(it => toDecimals(it, 18));

    console.log('Destinations', _destinationAmounts.map(it => fromDecimals(it, 18)));
    console.log("Total", fromDecimals(_destinationAmounts.reduce((acc, it) => acc.ethereansosAdd(it), '0'), 18));

    var TokenSafe = await compile('TokenSafe', 'TokenSafe');
    tokenSafe = await deployContract(new web3.eth.Contract(TokenSafe.abi), TokenSafe.bin, [_owner, _sourceTokenAddress, _destinations, _destinationAmounts], additionalData);
    console.log("Data", await tokenSafe.methods.data().call());
}

module.exports.test = async function test() {
    await setSourceTokenAddress();
}

async function setSourceTokenAddress() {
    var sourceTokenAddress = await tokenSafe.methods.sourceTokenAddress().call();
    if(sourceTokenAddress !== VOID_ETHEREUM_ADDRESS) {
        return;
    }
    await assert.catchCall(blockchainCall(tokenSafe.methods.setSourceTokenAddress, web3.currentProvider.knowledgeBase.fromAddress), "unauthorized");
    console.log("Source token address", await tokenSafe.methods.sourceTokenAddress().call());
    await blockchainCall(tokenSafe.methods.setSourceTokenAddress, accounts[2], additionalData);
    console.log("Source token address", await tokenSafe.methods.sourceTokenAddress().call());
}