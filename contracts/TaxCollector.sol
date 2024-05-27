// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20Token {
    function balanceOf(address owner) external view returns (uint);
    function transfer(address to, uint value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
}

interface IUniswapV2Router01 {
    function WETH() external pure returns (address);

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}

abstract contract TransferUtilities {

    function _safeTransfer(address tokenAddress, address to, uint256 value) internal {
        if(value == 0) {
            return;
        }
        if(to == address(this)) {
            return;
        }
        if(tokenAddress == address(0)) {
            require(_sendETH(to, value), 'FARMING: TRANSFER_FAILED');
            return;
        }
        if(to == address(0)) {
            return _safeBurn(tokenAddress, value);
        }
        (bool success, bytes memory data) = tokenAddress.call(abi.encodeWithSelector(IERC20Token(address(0)).transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'FARMING: TRANSFER_FAILED');
    }

    function _safeBurn(address erc20TokenAddress, uint256 value) internal {
        (bool result, bytes memory returnData) = erc20TokenAddress.call(abi.encodeWithSelector(0x42966c68, value));//burn(uint256)
        result = result && (returnData.length == 0 || abi.decode(returnData, (bool)));
        if(!result) {
            (result, returnData) = erc20TokenAddress.call(abi.encodeWithSelector(IERC20Token(erc20TokenAddress).transfer.selector, address(0), value));
            result = result && (returnData.length == 0 || abi.decode(returnData, (bool)));
        }
        if(!result) {
            (result, returnData) = erc20TokenAddress.call(abi.encodeWithSelector(IERC20Token(erc20TokenAddress).transfer.selector, 0x000000000000000000000000000000000000dEaD, value));
            result = result && (returnData.length == 0 || abi.decode(returnData, (bool)));
        }
        if(!result) {
            (result, returnData) = erc20TokenAddress.call(abi.encodeWithSelector(IERC20Token(erc20TokenAddress).transfer.selector, 0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD, value));
            result = result && (returnData.length == 0 || abi.decode(returnData, (bool)));
        }
    }

    function _sendETH(address to, uint256 value) internal returns(bool) {
        assembly {
            let res := call(gas(), to, value, 0, 0, 0, 0)
        }
        return true;
    }
}

abstract contract TokenSafeCommon is TransferUtilities {
    address public owner;

    address public sourceTokenAddress;

    constructor(address _owner, address _sourceTokenAddress) {
        owner = _owner;
        if(_sourceTokenAddress != address(0)) {
            _setSourceTokenAddress(_sourceTokenAddress);
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "unauthorized");
        _;
    }

    function setSourceTokenAddress() external {
        _setSourceTokenAddress(msg.sender);
    }

    function setSourceTokenAddressByOwner(address _sourceTokenAddress) external onlyOwner {
        _setSourceTokenAddress(_sourceTokenAddress);
    }

    function trigger() external onlyOwner {
        _trigger();
    }

    function safetyFlushToOwner() public virtual onlyOwner {
        _safeTransfer(sourceTokenAddress, owner, IERC20Token(sourceTokenAddress).balanceOf(address(this)));
    }

    function _setSourceTokenAddress(address _sourceTokenAddress) internal virtual {
        require(sourceTokenAddress == address(0) || msg.sender == sourceTokenAddress || msg.sender == owner, "unsettable");
        sourceTokenAddress = _sourceTokenAddress;
    }

    function _trigger() internal virtual;
}

contract TokenSafe is TokenSafeCommon {

    address[] public destinations;

    uint256[] public destinationAmounts;

    uint256[] public triggerLimits;

    mapping(uint256 => bool) public alreadySentToDestination;

    constructor(address _owner, address _sourceTokenAddress, address[] memory _destinations, uint256[] memory _destinationAmounts, uint256[] memory _triggerLimits) TokenSafeCommon(_owner, _sourceTokenAddress) {
        destinations = _destinations;
        destinationAmounts = _destinationAmounts;
        triggerLimits = _triggerLimits;
    }    
    
    function data() external view returns(address _owner, address _sourceTokenAddress, address[] memory _destinations, uint256[] memory _destinationAmounts, uint256[] memory _triggerLimits, bool[] memory _alreadySentToDestination) {
        _owner = owner;
        _sourceTokenAddress = sourceTokenAddress;
        _destinations = destinations;
        _destinationAmounts = destinationAmounts;
        _triggerLimits = triggerLimits;
        _alreadySentToDestination = new bool[](_destinations.length);
        for(uint256 i = 0; i < _alreadySentToDestination.length; i++) {
            _alreadySentToDestination[i] = alreadySentToDestination[i];
        }
    }

    function _trigger() internal override {
        uint256 collected = TaxCollector(owner).collected();
        for(uint256 i = 0; i < destinations.length; i++) {
            if(collected < triggerLimits[i] || alreadySentToDestination[i]) {
                continue;
            }
            alreadySentToDestination[i] = true;
            _safeTransfer(sourceTokenAddress, destinations[i], destinationAmounts[i]);   
        }
    }
}

contract TaxCollector is TokenSafeCommon {

    address public immutable destinationTokenAddress;

    address public immutable uniswapV2SwapRouterAddress;

    address public immutable destinationWallet;

    TokenSafe public tokenSafe;

    address[] public path;

    uint256 public collected;

    constructor(address _owner, address _sourceTokenAddress, address _destinationTokenAddress, address _uniswapV2SwapRouterAddress, address _destinationWallet, address[] memory _destinations, uint256[] memory _destinationAmounts, uint256[] memory _triggerLimits) TokenSafeCommon(_owner, _sourceTokenAddress) {
        destinationTokenAddress = _destinationTokenAddress;
        uniswapV2SwapRouterAddress = _uniswapV2SwapRouterAddress;
        destinationWallet = _destinationWallet;
        tokenSafe = new TokenSafe(address(this), _sourceTokenAddress, _destinations, _destinationAmounts, _triggerLimits);
    }

    function safetyFlushToOwner() public override onlyOwner {
        _safeTransfer(destinationTokenAddress, owner, IERC20Token(destinationTokenAddress).balanceOf(address(this)));
        tokenSafe.safetyFlushToOwner();
        super.safetyFlushToOwner();
    }

    function swap(uint256 amountOutMin) external onlyOwner returns(uint256 outputAmount) {
        uint256 amountIn = IERC20Token(sourceTokenAddress).balanceOf(address(this));
        IERC20Token(sourceTokenAddress).approve(uniswapV2SwapRouterAddress, amountIn);
        uint256 balanceBefore = IERC20Token(destinationTokenAddress).balanceOf(destinationWallet);
        IUniswapV2Router01(uniswapV2SwapRouterAddress).swapExactTokensForTokensSupportingFeeOnTransferTokens(amountIn, amountOutMin, _path(), destinationWallet, block.timestamp + 10000);
        outputAmount = IERC20Token(destinationTokenAddress).balanceOf(destinationWallet) - balanceBefore;
        collected += outputAmount;
        _trigger();
    }

    function _setSourceTokenAddress(address _sourceTokenAddress) internal override {
        super._setSourceTokenAddress(_sourceTokenAddress);
        tokenSafe.setSourceTokenAddressByOwner(_sourceTokenAddress);
    }

    function _trigger() internal override {
        tokenSafe.trigger();
    }

    function _path() internal returns(address[] memory) {
        if(path.length == 0) {
            require(sourceTokenAddress != address(0));
            path.push(sourceTokenAddress);
            path.push(IUniswapV2Router01(uniswapV2SwapRouterAddress).WETH());
            path.push(destinationTokenAddress);
        }
        return path;
    }
}