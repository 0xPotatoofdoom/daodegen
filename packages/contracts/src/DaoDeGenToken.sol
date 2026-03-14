// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title DaoDeGenToken
/// @notice ERC-20 token for the Dao DeGen ecosystem
/// @dev Burnable — callers burn $DAODEGEN to release fees from the jar
contract DaoDeGenToken is ERC20, ERC20Burnable {
    uint256 public constant MAX_SUPPLY = 81_000_000e18; // 81M — one million per verse

    constructor(address _initialHolder) ERC20("Dao DeGen", "DAODEGEN") {
        require(_initialHolder != address(0), "Invalid holder address");
        _mint(_initialHolder, MAX_SUPPLY);
    }
}
