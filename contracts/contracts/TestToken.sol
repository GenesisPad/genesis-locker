// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor() ERC20("Genesis Locker Test Token", "GLTT") {
        _mint(msg.sender, 1_000_000 ether);
    }
}

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_, uint256 supply) ERC20(name_, symbol_) {
        _mint(msg.sender, supply);
    }
}

contract MockDexFactory {
    string public dexName;

    event PairCreated(address indexed tokenA, address indexed tokenB, address indexed pair, string dexName);

    constructor(string memory name_) {
        dexName = name_;
    }

    function createPair(
        address tokenA,
        address tokenB,
        string memory pairName,
        string memory pairSymbol,
        uint256 supply
    ) external returns (address pair) {
        MockERC20 lpToken = new MockERC20(pairName, pairSymbol, supply);
        pair = address(lpToken);
        lpToken.transfer(msg.sender, supply);
        emit PairCreated(tokenA, tokenB, pair, dexName);
    }
}
