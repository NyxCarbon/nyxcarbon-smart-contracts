// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

// modules
import {LSP8Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/presets/LSP8Mintable.sol";
import {LoanState} from "../LoanEnums.sol";

// constants
import {_LSP8_TOKENID_FORMAT_NUMBER} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/LSP8Constants.sol";
import {_LSP4_TOKEN_TYPE_NFT} from "@lukso/lsp-smart-contracts/contracts/LSP4DigitalAssetMetadata/LSP4Constants.sol";
import {_NYX_INITIAL_LOAN_AMOUNT, _NYX_LOAN_APY, _NYX_AMORITIZATION_PERIOD, _NYX_LOCKUP_PERIOD, _NYX_TRANSACTION_BPS, _NYX_TOKEN_ADDRESS, _NYX_LENDER, _NYX_BORROWER, _NYX_CARBON_CREDITS_GENERATED, _NYX_CARBON_CREDITS_BALANCE, _NYX_CARBON_CREDITS_PRICE, _NYX_LOAN_BALANCE, _NYX_LOAN_STATUS, _NYX_PAYMENT_INDEX, _NYX_CADT_PROJECT_NAME, _NYX_CADT_REGISTRY_LINK} from "./constants.sol";

contract NonCollateralizedLoanNFT is LSP8Mintable {
    constructor(
        string memory name_,
        string memory symbol_,
        address newOwner_
    )
        LSP8Mintable(
            name_,
            symbol_,
            newOwner_,
            _LSP4_TOKEN_TYPE_NFT,
            _LSP8_TOKENID_FORMAT_NUMBER
        )
    {}

    function mintNFT(
        uint256 tokenId,
        uint256 _initialLoanAmount,
        uint256 _apy,
        uint256 _amortizationPeriodInMonths,
        uint256 _lockUpPeriodInMonths,
        uint256 _transactionBps,
        address payable _lender,
        address payable _borrower,
        int256 _carbonCreditsGenerated,
        string memory _cadtProjectName,
        string memory _cadtRegistryLink
    ) external returns (uint256) {
        // Mint NFT
        mint(msg.sender, bytes32(tokenId), true, "0x");

        // Define arrays for storing data in LSP2 contract
        bytes32[] memory tokenIds = new bytes32[](14);
        bytes32[] memory dataKeys = new bytes32[](14);
        bytes[] memory dataValues = new bytes[](14);

        // Assign values to the arrays
        tokenIds[0] = bytes32(tokenId);
        tokenIds[1] = bytes32(tokenId);
        tokenIds[2] = bytes32(tokenId);
        tokenIds[3] = bytes32(tokenId);
        tokenIds[4] = bytes32(tokenId);
        tokenIds[5] = bytes32(tokenId);
        tokenIds[6] = bytes32(tokenId);
        tokenIds[7] = bytes32(tokenId);
        tokenIds[8] = bytes32(tokenId);
        tokenIds[9] = bytes32(tokenId);
        tokenIds[10] = bytes32(tokenId);
        tokenIds[11] = bytes32(tokenId);
        tokenIds[12] = bytes32(tokenId);
        tokenIds[13] = bytes32(tokenId);

        dataKeys[0] = _NYX_INITIAL_LOAN_AMOUNT;
        dataKeys[1] = _NYX_LOAN_APY;
        dataKeys[2] = _NYX_AMORITIZATION_PERIOD;
        dataKeys[3] = _NYX_LOCKUP_PERIOD;
        dataKeys[4] = _NYX_TRANSACTION_BPS;
        dataKeys[5] = _NYX_LENDER;
        dataKeys[6] = _NYX_BORROWER;
        dataKeys[7] = _NYX_CARBON_CREDITS_GENERATED;
        dataKeys[8] = _NYX_CARBON_CREDITS_BALANCE;
        dataKeys[9] = _NYX_LOAN_BALANCE;
        dataKeys[10] = _NYX_LOAN_STATUS;
        dataKeys[11] = _NYX_PAYMENT_INDEX;
        dataKeys[12] = _NYX_CADT_PROJECT_NAME;
        dataKeys[13] = _NYX_CADT_REGISTRY_LINK;

        dataValues[0] = abi.encode(_initialLoanAmount * 1e18);
        dataValues[1] = abi.encode(_apy * 1e18);
        dataValues[2] = abi.encode(_amortizationPeriodInMonths);
        dataValues[3] = abi.encode(_lockUpPeriodInMonths);
        dataValues[4] = abi.encode(_transactionBps);
        dataValues[5] = abi.encode(_lender);
        dataValues[6] = abi.encode(_borrower);
        dataValues[7] = abi.encode(_carbonCreditsGenerated);
        dataValues[8] = abi.encode(_carbonCreditsGenerated);
        dataValues[9] = abi.encode(_initialLoanAmount * 1e18);
        dataValues[10] = abi.encode(LoanState.Taken);
        dataValues[11] = abi.encode(0);
        dataValues[12] = bytes(_cadtProjectName);
        dataValues[13] = bytes(_cadtRegistryLink);

        // Call function to set multiple key-value pairs
        setDataBatchForTokenIds(tokenIds, dataKeys, dataValues);
    }

    function getDecodedInt256(
        uint256 tokenId,
        bytes32 dataKey
    ) external view returns (int256) {
        bytes memory data = getDataForTokenId(bytes32(tokenId), dataKey);
        return abi.decode(data, (int256));
    }

    function getDecodedUint256(
        uint256 tokenId,
        bytes32 dataKey
    ) external view returns (uint256) {
        bytes memory data = getDataForTokenId(bytes32(tokenId), dataKey);
        return abi.decode(data, (uint256));
    }

    function getDecodedAddress(
        uint256 tokenId,
        bytes32 dataKey
    ) external view returns (address) {
        bytes memory data = getDataForTokenId(bytes32(tokenId), dataKey);
        return abi.decode(data, (address));
    }

    function getDecodedString(
        uint256 tokenId,
        bytes32 dataKey
    ) external view returns (string memory) {
        bytes memory data = getDataForTokenId(bytes32(tokenId), dataKey);
        return string(data);
    }
}
