// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Derizer (DRZ)
/// @notice Fixed-supply ERC-20 token. The entire supply is minted once to
/// the deployer at construction time; there is no mint function afterward,
/// so the total supply can never change.
contract Derizer is ERC20 {
    constructor() ERC20("Derizer", "DRZ") {
        // 21,000,000 DRZ, scaled by the token's 18 decimals.
        _mint(msg.sender, 21_000_000 * 10 ** decimals());
    }
}