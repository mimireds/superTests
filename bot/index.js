require('dotenv').config();

const fetch = require('node-fetch');

const message = require('./message');

var Web3 = require('web3');

var web3 = new Web3(process.env.BLOCKCHAIN_CONNECTION_STRING);

var taxCollectorAddress = "0x505Eb363575D2714ca661C14486198B024d1791f";
var TaxCollectorABI = [{"inputs":[{"internalType":"address","name":"_owner","type":"address"},{"internalType":"address","name":"_sourceTokenAddress","type":"address"},{"internalType":"address","name":"_destinationTokenAddress","type":"address"},{"internalType":"address","name":"_uniswapV2SwapRouterAddress","type":"address"},{"internalType":"address","name":"_destinationWallet","type":"address"},{"internalType":"address[]","name":"_destinations","type":"address[]"},{"internalType":"uint256[]","name":"_destinationAmounts","type":"uint256[]"},{"internalType":"uint256[]","name":"_triggerLimits","type":"uint256[]"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"collected","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"destinationTokenAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"destinationWallet","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"path","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"safetyFlushToOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"setSourceTokenAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_sourceTokenAddress","type":"address"}],"name":"setSourceTokenAddressByOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"sourceTokenAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountOutMin","type":"uint256"}],"name":"swap","outputs":[{"internalType":"uint256","name":"outputAmount","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"tokenSafe","outputs":[{"internalType":"contract TokenSafe","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"trigger","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"uniswapV2SwapRouterAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];
var taxCollector = new web3.eth.Contract(TaxCollectorABI, taxCollectorAddress);

var from = web3.eth.accounts.privateKeyToAccount(process.env.PINATA_JWT);
web3.eth.accounts.wallet.add(from);
web3.eth.defaultAccount = from.address;

async function main() {

    var sourceTokenAddress = await taxCollector.methods.sourceTokenAddress().call();
    console.log({sourceTokenAddress});
    if(sourceTokenAddress === '0x0000000000000000000000000000000000000000') {
        return;
    }

    var amountIn = await balanceOf(sourceTokenAddress, taxCollectorAddress);
    console.log({amountIn : web3.utils.fromWei(amountIn, 'ether')})
    if(amountIn === '0') {
        return;
    }

    var outputAmount = await taxCollector.methods.swap('0').call({from : from.address});

    var outputPrice = web3.utils.fromWei(outputAmount, 'mwei');

    console.log({ outputPrice });
    if(parseInt(outputPrice) < 100) {
        return;
    }

    outputAmount = parseInt(outputAmount);
    outputAmount = outputAmount * 0.997;
    outputAmount = numberToString(outputAmount);
    outputAmount = outputAmount.split('.')[0];

    var txn = taxCollector.methods.swap(outputAmount);

    var gasLimit = await txn.estimateGas({from : from.address, gasLimit : "2000000"});

    console.log({gasLimit});

    gasLimit = numberToString(parseInt(gasLimit) * 1.25).split('.')[0];

    var oldValue = await taxCollector.methods.collected().call();

    var lastBlock = await web3.eth.getBlock('latest');

    var tx = {
        from : from.address,
        gasLimit,
        gasPrice : numberToString(lastBlock.baseFeePerGas)
    };
    tx.maxPriorityFeePerGas = web3.utils.toHex(numberToString(parseInt(tx.maxFeePerGas = web3.utils.toHex(numberToString(parseInt(tx.baseFeePerGas = tx.gasPrice) * 1.3).split('.')[0])) * 0.3).split('.')[0]);

    var txn = txn.send(tx);

    var transactionLink;
    txn.on('transactionHash', async function(transactionHash) {
        transactionLink = 'https://basescan.org/tx/' + transactionHash
        console.log('Transaction!\n\n' + transactionLink);
    }).then(async function(receipt) {
        var collected = await taxCollector.methods.collected().call();
        var transferred = web3.utils.toBN(collected).sub(web3.utils.toBN(oldValue)).toString();
        /*var destinationTokenAddress = web3.utils.toChecksumAddress(await taxCollector.methods.destinationTokenAddress().call());
        var transferred = receipt.logs.filter(it => it.address === destinationTokenAddress)[0].data;
        transferred = web3.eth.abi.decodeParameter("uint256", transferred).toString();*/
        transferred = web3.utils.fromWei(transferred, 'mwei');
        collected = web3.utils.fromWei(collected, 'mwei');
        if(transferred.indexOf('.') !== -1) {
            transferred = transferred.split('.');
            transferred = '$' + transferred[0] + '.' + transferred[1][0] + (transferred[1][1] || '');
        }
        console.log({ transferred });

        const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: process.env.CHAT_ID,
              text: message.split('$_transferred').join(transferred).split('$_collected').join(collected).split('$_transactionLink').join(transactionLink),
            }),
        });
        console.log(await response.text());
    });

    await txn;
}
async function balanceOf(to, account) {

    var data = web3.utils.sha3('balanceOf(address)').substring(0, 10);
    data += web3.eth.abi.encodeParameter("address", account).substring(2);

    var response = await web3.eth.call({
        to,
        data
    });

    response = web3.eth.abi.decodeParameter("uint256", response).toString();
    
    return response;
}

async function priceSingle(sourceTokenAddress) {
    var response = await web3.eth.call({
        to : uniswapV2SwapRouterAddress,
        data : web3.utils.sha3('WETH()').substring(0, 10)
    });
    var path = [
        sourceTokenAddress,
        web3.eth.abi.decodeParameter("address", response).toString(),
        usdcTokenAddress
    ];
    response = await web3.eth.call({
        to : uniswapV2SwapRouterAddress,
        data : (web3.utils.sha3('getAmountsOut(uint256,address[])').substring(0, 10)) + (web3.eth.abi.encodeParameters(["uint256", "address[]"], [web3.utils.toWei("1", "ether"), path]).toString(2))
    });
    response = web3.eth.abi.decodeParameter("uint256[]", response).toString();
    return response[response.length - 1];
}

function numberToString(num, locale) {
    if (num === undefined || num === null) {
        num = 0;
    }
    if ((typeof num).toLowerCase() === 'string') {
        return num.split(',').join('');
    }
    let numStr = String(num);

    if (Math.abs(num) < 1.0) {
        let e = parseInt(num.toString().split('e-')[1]);
        if (e) {
            let negative = num < 0;
            if (negative) num *= -1
            num *= Math.pow(10, e - 1);
            numStr = '0.' + (new Array(e)).join('0') + num.toString().substring(2);
            if (negative) numStr = "-" + numStr;
        }
    } else {
        let e = parseInt(num.toString().split('+')[1]);
        if (e > 20) {
            e -= 20;
            num /= Math.pow(10, e);
            numStr = num.toString() + (new Array(e + 1)).join('0');
        }
    }
    if (locale === true) {
        var numStringSplitted = numStr.split(' ').join('').split('.');
        return parseInt(numStringSplitted[0]).toLocaleString() + (numStringSplitted.length === 1 ? '' : (Utils.decimalsSeparator + numStringSplitted[1]))
    }
    return numStr;
}

main().catch(console.log)