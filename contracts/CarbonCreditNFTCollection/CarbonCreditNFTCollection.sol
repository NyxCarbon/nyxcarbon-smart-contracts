// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

// modules
import {LSP8Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/presets/LSP8Mintable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

// constants
import {_LSP8_TOKENID_TYPE_NUMBER} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/LSP8Constants.sol";
import {_LSP4_TOKEN_TYPE_DATA_KEY, TokenType} from "./TokenTypes.sol";

contract CarbonCreditNFTCollection is LSP8Mintable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    struct CarbonCredit {
        uint256 id;
        string projectName;
        string registryLink;
        uint256 units;
    }
    mapping(uint256 => CarbonCredit) private _carbonCredits;

    constructor(
        string memory carbonCreditNFTCollectionName,
        string memory carbonCreditNFTCollectionSymbol,
        address contractOwner
    )
        LSP8Mintable(
            carbonCreditNFTCollectionName,
            carbonCreditNFTCollectionSymbol,
            contractOwner,
            _LSP8_TOKENID_TYPE_NUMBER
        )
    {
        _setData(_LSP4_TOKEN_TYPE_DATA_KEY, abi.encode(TokenType.COLLECTION));
    }

    function mintCarbonCreditNFT(
        address to,
        string memory projectName,
        string memory registryLink,
        uint256 units
    ) external returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        CarbonCredit memory newCarbonCredit = CarbonCredit({
            id: newTokenId,
            projectName: projectName,
            registryLink: registryLink,
            units: units
        });
        _carbonCredits[newTokenId] = newCarbonCredit;

        mint(to, bytes32(newTokenId), true, "0x");
        return newTokenId;
    }

    function getCarbonCreditNFT(
        uint256 tokenId
    ) external view returns (uint256, string memory, string memory, uint256) {
        CarbonCredit memory cc = _carbonCredits[tokenId];
        return (cc.id, cc.projectName, cc.registryLink, cc.units);
    }
}
