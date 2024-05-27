var { VOID_ETHEREUM_ADDRESS, abi, VOID_BYTES32, blockchainCall, sendBlockchainTransaction, numberToString, compile, sendAsync, deployContract, abi, MAX_UINT256, web3Utils, fromDecimals, toDecimals } = global.multiverse = require('@ethereansos/multiverse');

var additionalData = { from : web3.currentProvider.knowledgeBase.from };

var taxCollector;
var tokenSafe;

module.exports = async function start() {
    var totalSupply = "47000000000";
    var burnWallet = VOID_ETHEREUM_ADDRESS;
    var _destinationWallet = "0x94845333028B1204Fbe14E1278Fd4Adde46B22ce";
    var _owner = web3.currentProvider.knowledgeBase.fromAddress;
    var _sourceTokenAddress = process.env.SOURCE_TOKEN_ADDRESS || VOID_ETHEREUM_ADDRESS;
    var _destinationTokenAddress = web3.currentProvider.knowledgeBase.USDC_TOKEN_ADDRESS;
    var _uniswapV2SwapRouterAddress = web3.currentProvider.knowledgeBase.UNISWAP_V2_SWAP_ROUTER_ADDRESS;
    var _triggerLimits = [1000000, 5000000, 10000000, 50000000].map(it => toDecimals(it, 6));
    var _destinations = [burnWallet, _destinationWallet, burnWallet, _destinationWallet];
    var _destinationAmounts = [1, 0.5, 4, 5].map(it => it / 100).map(it => it * parseInt(totalSupply)).map(it => numberToString(it).split('.')[0]).map(it => toDecimals(it, 18));

    console.log('Destinations', _destinationAmounts.map(it => fromDecimals(it, 18)));
    var totalTokensToSend = fromDecimals(_destinationAmounts.reduce((acc, it) => acc.ethereansosAdd(it), '0'), 18);
    console.log("Total", totalTokensToSend);

    var TaxCollector = await compile('TaxCollector', 'TaxCollector');
    taxCollector = await deployContract(new web3.eth.Contract(TaxCollector.abi), TaxCollector.bin, [_owner, _sourceTokenAddress, _destinationTokenAddress, _uniswapV2SwapRouterAddress, _destinationWallet, _destinations, _destinationAmounts, _triggerLimits], additionalData);
    var tokenSafeAddress;
    console.log("TAX COLLECTOR", taxCollector.options.address, {
        owner : await taxCollector.methods.owner().call(),
        sourceTokenAddress : await taxCollector.methods.sourceTokenAddress().call(),
        uniswapV2SwapRouterAddress : await taxCollector.methods.uniswapV2SwapRouterAddress().call(),
        destinationTokenAddress : await taxCollector.methods.destinationTokenAddress().call(),
        destinationWallet : await taxCollector.methods.destinationWallet().call(),
        tokenSafe : tokenSafeAddress = await taxCollector.methods.tokenSafe().call()
    });
    console.log("SAFE", tokenSafeAddress, { totalTokensToSend }, await (tokenSafe = new web3.eth.Contract((await compile("TaxCollector", "TokenSafe")).abi, tokenSafeAddress)).methods.data().call());
}

module.exports.test = async function test() {
    await setSourceTokenAddress();
}

async function setSourceTokenAddress() {
    var sourceTokenAddress = await taxCollector.methods.sourceTokenAddress().call();
    if(sourceTokenAddress !== VOID_ETHEREUM_ADDRESS) {
        return;
    }
    console.log("Source token address", await taxCollector.methods.sourceTokenAddress().call());
    await blockchainCall(taxCollector.methods.setSourceTokenAddress, {from : accounts[1]});
    console.log("Source token address", await taxCollector.methods.sourceTokenAddress().call());
    await assert.catchCall(blockchainCall(taxCollector.methods.setSourceTokenAddress, { from : accounts[2]}), "unsettable");
    console.log("Source token address", await taxCollector.methods.sourceTokenAddress().call());
    await blockchainCall(taxCollector.methods.setSourceTokenAddress, {from : accounts[1]});
    console.log("Source token address", await taxCollector.methods.sourceTokenAddress().call());
    await assert.catchCall(blockchainCall(taxCollector.methods.setSourceTokenAddressByOwner, web3.currentProvider.knowledgeBase.fromAddress), "unauthorized");
    console.log("Source token address", await taxCollector.methods.sourceTokenAddress().call());
    await blockchainCall(taxCollector.methods.setSourceTokenAddressByOwner, accounts[2], additionalData);
    console.log("Source token address", await taxCollector.methods.sourceTokenAddress().call());
    await assert.catchCall(blockchainCall(taxCollector.methods.setSourceTokenAddress, { from : accounts[1]}), "unsettable");
    console.log("Source token address", await taxCollector.methods.sourceTokenAddress().call());
    await blockchainCall(taxCollector.methods.setSourceTokenAddress, {from : accounts[2]});
    console.log("Source token address", await taxCollector.methods.sourceTokenAddress().call());
}