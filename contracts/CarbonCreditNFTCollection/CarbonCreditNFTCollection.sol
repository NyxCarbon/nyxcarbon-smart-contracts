// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

// modules
import {LSP8Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/presets/LSP8Mintable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

// constants
import {_LSP8_TOKENID_FORMAT_NUMBER} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/LSP8Constants.sol";
import {_LSP4_TOKEN_TYPE_COLLECTION} from "@lukso/lsp-smart-contracts/contracts/LSP4DigitalAssetMetadata/LSP4Constants.sol";
import {_NYXCC_PROJECT_NAME_DATA_KEY, _NYXCC_REGISTRY_LINK_DATA_KEY, _NYXCC_UNITS_DATA_KEY} from "./constants.sol";

contract CarbonCreditNFTCollection is LSP8Mintable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    event Minted(
        address to,
        uint256 id,
        string projectName,
        string registryLink,
        string units
    );

    constructor(
        string memory carbonCreditNFTCollectionName,
        string memory carbonCreditNFTCollectionSymbol,
        address contractOwner
    )
        LSP8Mintable(
            carbonCreditNFTCollectionName,
            carbonCreditNFTCollectionSymbol,
            contractOwner,
            _LSP4_TOKEN_TYPE_COLLECTION,
            _LSP8_TOKENID_FORMAT_NUMBER
        )
    {}

    function mintCarbonCreditNFT(
        address to,
        string memory projectName,
        string memory registryLink,
        string memory units
    ) external returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        // Mint token
        mint(to, bytes32(newTokenId), true, "0x");

        // Define arrays for storing data in ERC725Y contract
        bytes32[] memory tokenIds = new bytes32[](3);
        bytes32[] memory dataKeys = new bytes32[](3);
        bytes[] memory dataValues = new bytes[](3);

        // Assign values to the arrays
        tokenIds[0] = bytes32(newTokenId);
        tokenIds[1] = bytes32(newTokenId);
        tokenIds[2] = bytes32(newTokenId);

        dataKeys[0] = _NYXCC_PROJECT_NAME_DATA_KEY;
        dataKeys[1] = _NYXCC_REGISTRY_LINK_DATA_KEY;
        dataKeys[2] = _NYXCC_UNITS_DATA_KEY;

        dataValues[0] = bytes(projectName);
        dataValues[1] = bytes(registryLink);
        dataValues[2] = bytes(units);

        // Call function to set multiple key-value pairs
        setDataBatchForTokenIds(tokenIds, dataKeys, dataValues);

        emit Minted(to, newTokenId, projectName, registryLink, units);
        return newTokenId;
    }

    function getCarbonCreditNFT(
        uint256 tokenId
    ) external view returns (bytes[] memory dataValues) {
        bytes32[] memory tokenIds = new bytes32[](3);
        bytes32[] memory dataKeys = new bytes32[](3);

        tokenIds[0] = bytes32(tokenId);
        tokenIds[1] = bytes32(tokenId);
        tokenIds[2] = bytes32(tokenId);

        dataKeys[0] = _NYXCC_PROJECT_NAME_DATA_KEY;
        dataKeys[1] = _NYXCC_REGISTRY_LINK_DATA_KEY;
        dataKeys[2] = _NYXCC_UNITS_DATA_KEY;

        bytes[] memory data = getDataBatchForTokenIds(tokenIds, dataKeys);
        return (data);
    }
}
