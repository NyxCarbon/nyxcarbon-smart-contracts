// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

// modules
import {LSP2Utils} from "@lukso/lsp-smart-contracts/contracts/LSP2ERC725YJSONSchema/LSP2Utils.sol";
import {LSP8Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/presets/LSP8Mintable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

// constants
import {_LSP8_TOKENID_FORMAT_NUMBER} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/LSP8Constants.sol";
import {_LSP4_TOKEN_TYPE_COLLECTION, _LSP4_CREATORS_ARRAY_KEY} from "@lukso/lsp-smart-contracts/contracts/LSP4DigitalAssetMetadata/LSP4Constants.sol";
import {_LSP12_ISSUED_ASSETS_ARRAY_KEY} from "@lukso/lsp-smart-contracts/contracts/LSP12IssuedAssets/LSP12Constants.sol";
import {_RWAV_PROJECT_NAME_DATA_KEY, _RWAV_REGISTRY_LINK_DATA_KEY, _RWAV_UNITS_DATA_KEY, _RWAV_GEOGRAPHIC_IDENTIFIER_DATA_KEY} from "./constants.sol";

import "hardhat/console.sol";

contract RWAVerification is LSP8Mintable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    event Minted(
        address to,
        uint256 id,
        string projectName,
        string registryLink,
        uint256 units,
        string geographicIdentifier,
        address[] creators
    );

    constructor(
        string memory name,
        string memory symbol,
        address owner
    )
        LSP8Mintable(
            name,
            symbol,
            owner,
            _LSP4_TOKEN_TYPE_COLLECTION,
            _LSP8_TOKENID_FORMAT_NUMBER
        )
    {}

    function mintNFT(
        address to,
        string memory projectName,
        string memory registryLink,
        uint256 units,
        string memory geographicIdentifier
    ) external returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        address[] memory creators = new address[](1);
        creators[0] = owner();

        emit Minted(
            to,
            newTokenId,
            projectName,
            registryLink,
            units,
            geographicIdentifier,
            creators
        );

        // Define arrays for storing data in ERC725Y contract
        bytes32[] memory tokenIds = new bytes32[](5);
        bytes32[] memory dataKeys = new bytes32[](5);
        bytes[] memory dataValues = new bytes[](5);

        // Assign values to the arrays
        tokenIds[0] = bytes32(newTokenId);
        tokenIds[1] = bytes32(newTokenId);
        tokenIds[2] = bytes32(newTokenId);
        tokenIds[3] = bytes32(newTokenId);
        tokenIds[4] = bytes32(newTokenId);

        dataKeys[0] = _RWAV_PROJECT_NAME_DATA_KEY;
        dataKeys[1] = _RWAV_REGISTRY_LINK_DATA_KEY;
        dataKeys[2] = _RWAV_UNITS_DATA_KEY;
        dataKeys[3] = _RWAV_GEOGRAPHIC_IDENTIFIER_DATA_KEY;
        dataKeys[4] = _LSP4_CREATORS_ARRAY_KEY;

        dataValues[0] = bytes(projectName);
        dataValues[1] = bytes(registryLink);
        dataValues[2] = abi.encode(units);
        dataValues[3] = bytes(geographicIdentifier);
        dataValues[4] = abi.encode(creators);

        // Call function to set multiple key-value pairs
        setDataBatchForTokenIds(tokenIds, dataKeys, dataValues);

        // Mint token
        mint(to, bytes32(newTokenId), true, "0x");

        return newTokenId;
    }

    function getNFT(
        uint256 tokenId
    ) external view returns (bytes[] memory dataValues) {
        bytes32[] memory tokenIds = new bytes32[](4);
        bytes32[] memory dataKeys = new bytes32[](4);

        tokenIds[0] = bytes32(tokenId);
        tokenIds[1] = bytes32(tokenId);
        tokenIds[2] = bytes32(tokenId);
        tokenIds[3] = bytes32(tokenId);

        dataKeys[0] = _RWAV_PROJECT_NAME_DATA_KEY;
        dataKeys[1] = _RWAV_REGISTRY_LINK_DATA_KEY;
        dataKeys[2] = _RWAV_UNITS_DATA_KEY;
        dataKeys[3] = _RWAV_GEOGRAPHIC_IDENTIFIER_DATA_KEY;

        bytes[] memory data = getDataBatchForTokenIds(tokenIds, dataKeys);
        return (data);
    }
}
