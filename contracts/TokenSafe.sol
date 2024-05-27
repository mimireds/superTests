// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20Token {
    function balanceOf(address owner) external view returns (uint);
    function transfer(address to, uint value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
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

contract TokenSafe is TransferUtilities {

    address public owner;

    address public sourceTokenAddress;

    address[] public destinations;

    uint256[] public destinationAmounts;

    mapping(uint256 => bool) public alreadySentToDestination;

    constructor(address _owner, address _sourceTokenAddress, address[] memory _destinations, uint256[] memory _destinationAmounts) {
        owner = _owner;
        sourceTokenAddress = _sourceTokenAddress;
        destinations = _destinations;
        destinationAmounts = _destinationAmounts;
    }

    function data() external view returns(address _owner, address _sourceTokenAddress, address[] memory _destinations, uint256[] memory _destinationAmounts, bool[] memory _alreadySentToDestination) {
        _owner = owner;
        _sourceTokenAddress = sourceTokenAddress;
        _destinations = destinations;
        _destinationAmounts = destinationAmounts;
        _alreadySentToDestination = new bool[](_destinations.length);
        for(uint256 i = 0; i < _alreadySentToDestination.length; i++) {
            _alreadySentToDestination[i] = alreadySentToDestination[i];
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "unauthorized");
        _;
    }

    function setSourceTokenAddress(address _sourceTokenAddress) external onlyOwner {
        sourceTokenAddress = _sourceTokenAddress;
    }

    function flush() external onlyOwner {
        _safeTransfer(sourceTokenAddress, owner, IERC20Token(sourceTokenAddress).balanceOf(address(this)));
    }

    function trigger(uint256[] memory indices) external onlyOwner {
        for(uint256 i = 0; i < indices.length; i++) {
            uint256 index = indices[i];
            if(alreadySentToDestination[index]) {
                continue;
            }
            alreadySentToDestination[index] = true;
            _safeTransfer(sourceTokenAddress, destinations[index], destinationAmounts[index]);   
        }
    }
}