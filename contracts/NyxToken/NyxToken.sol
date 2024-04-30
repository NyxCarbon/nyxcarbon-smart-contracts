// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/presets/LSP7Mintable.sol";
import "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/extensions/LSP7Burnable.sol";

contract NyxToken is LSP7Mintable, LSP7Burnable {
    constructor() LSP7Mintable("NYXd Token", "NYXd", msg.sender, 0, false) {
        mint(msg.sender, 500000 * 10 ** decimals(), true, "0x");
    }
}
