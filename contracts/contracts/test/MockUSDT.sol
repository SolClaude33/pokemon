// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only USDT (18 decimals like BSC's Binance-Peg USDT) with an open faucet.
/// Used on the local chain and BSC testnet; never deployed to mainnet.
contract MockUSDT is ERC20 {
    constructor() ERC20("Test Tether USD", "USDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
