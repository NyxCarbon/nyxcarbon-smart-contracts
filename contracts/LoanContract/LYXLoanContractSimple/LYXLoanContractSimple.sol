// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

// modules
import {ILYXLoanContractSimple} from "./ILYXLoanContractSimple.sol";
import {LoanTxData} from "../LoanTxData/LoanTxData.sol";
import {RWAVerification} from "../../RWAVerification/RWAVerification.sol";
import {PaymentNotDue, ZeroBalanceOnLoan, ActionNotAllowedInCurrentState, ActionNotAllowedInCurrentStates, Unauthorized} from "../NonCollateralizedLoanErrors.sol";
import {LoanState} from "../LoanEnums.sol";
import "../LoanMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// constants
import {_NYX_INITIAL_LOAN_AMOUNT, _NYX_LOAN_APY, _NYX_AMORITIZATION_PERIOD, _NYX_GRACE_PERIOD, _NYX_TRANSACTION_BPS, _NYX_TOKEN_ADDRESS, _NYX_LENDER, _NYX_BORROWER, _NYX_CARBON_CREDITS_STAKED, _NYX_CARBON_CREDITS_BALANCE, _NYX_CARBON_CREDITS_PRICE, _NYX_LOAN_BALANCE, _NYX_LOAN_STATUS, _NYX_PAYMENT_INDEX, _NYX_VERIFIED_PROJECT_NAMES, _NYX_VERIFIED_PROJECT_LINKS, _NYX_VERIFIED_PROJECT_UNITS, _NYX_VERIFIED_PROJECT_GEOGRAPHIC_IDENTIFIERS, _NYX_RWAV_TOKEN_IDS} from "../LoanTxData/constants.sol";

contract LYXLoanContractSimple is ILYXLoanContractSimple, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    LoanTxData public immutable loanTxData;
    RWAVerification public immutable rwaVerification;

    int256 public carbonCreditPrice;
    mapping(uint256 => uint256[]) public paymentSchedules;

    mapping(uint256 => bool) private tokenLocks;

    constructor(
        address payable loanTxDataAddress,
        address payable rwaVerificationAddress
    ) {
        loanTxData = LoanTxData(loanTxDataAddress);
        rwaVerification = RWAVerification(rwaVerificationAddress);
    }

    // PERMISSIONS MODIFIERS
    modifier onlyInState(uint256 tokenId, LoanState expectedState) {
        LoanState currentLoanState = LoanState(
            loanTxData.getDecodedUint256(tokenId, _NYX_LOAN_STATUS)
        );
        if (currentLoanState != expectedState)
            revert ActionNotAllowedInCurrentState(
                currentLoanState,
                expectedState
            );
        _;
    }

    modifier onlyInStates(
        uint256 tokenId,
        LoanState expectedState1,
        LoanState expectedState2
    ) {
        LoanState currentLoanState = LoanState(
            loanTxData.getDecodedUint256(tokenId, _NYX_LOAN_STATUS)
        );
        if (
            currentLoanState != expectedState1 &&
            currentLoanState != expectedState2
        )
            revert ActionNotAllowedInCurrentStates(
                currentLoanState,
                expectedState1,
                expectedState2
            );
        _;
    }

    modifier onlyLender(uint256 tokenId) {
        if (msg.sender != loanTxData.getDecodedAddress(tokenId, _NYX_LENDER))
            revert Unauthorized(msg.sender);
        _;
    }

    modifier onlyBorrower(uint256 tokenId) {
        if (msg.sender != loanTxData.getDecodedAddress(tokenId, _NYX_BORROWER))
            revert Unauthorized(msg.sender);
        _;
    }

    modifier nonReentrant(uint256 tokenId) {
        require(
            !tokenLocks[tokenId],
            "Reentrant call detected for this token!"
        );
        tokenLocks[tokenId] = true;
        _;
        tokenLocks[tokenId] = false;
    }

    // LOAN UTILITY FUNCTIONS
    function setCarbonCreditPrice(int256 price) public onlyOwner {
        carbonCreditPrice = price;
    }

    function getPaymentSchedule(
        uint256 tokenId
    ) public view returns (uint256[] memory) {
        return paymentSchedules[tokenId];
    }

    function setPaymentSchedule(
        uint256 tokenId,
        uint256[] memory schedule
    ) public onlyOwner {
        paymentSchedules[tokenId] = schedule;
    }

    function callSetDataForTokenId(
        uint256 tokenId,
        bytes32 dataKey,
        bytes memory dataValue
    ) public onlyOwner {
        loanTxData.setDataForTokenId(bytes32(tokenId), dataKey, dataValue);
    }

    function calculatePayment(
        uint256 tokenId
    ) public view returns (uint256, uint256) {
        uint256 amortizationPeriodInMonths = loanTxData.getDecodedUint256(
            tokenId,
            _NYX_AMORITIZATION_PERIOD
        );

        uint256 transactionBps = loanTxData.getDecodedUint256(
            tokenId,
            _NYX_TRANSACTION_BPS
        );

        uint256 paymentIndex = loanTxData.getDecodedUint256(
            tokenId,
            _NYX_PAYMENT_INDEX
        );

        uint256 loanCurrentBalance = loanTxData.getDecodedUint256(
            tokenId,
            _NYX_LOAN_BALANCE
        );

        (uint256 monthlyPayment, uint256 monthlyFee) = LoanMath
            .calculateMonthlyPayment(
                loanCurrentBalance,
                transactionBps,
                amortizationPeriodInMonths - paymentIndex
            );

        return (monthlyPayment, monthlyFee);
    }

    function createLSP2ArrayLengthKey(
        string memory keyName
    ) public pure returns (bytes32) {
        return keccak256(bytes(keyName));
    }

    function createLSP2ArrayIndexKey(
        bytes32 dataKey,
        uint128 arrayIndex
    ) public pure returns (bytes32) {
        return bytes32(abi.encodePacked(bytes16(dataKey), bytes16(arrayIndex)));
    }

    function addVerifiedProject(
        uint256 tokenId,
        string memory projectName,
        string memory projectLink,
        uint256 units,
        string memory geographicIdentifier
    ) public onlyOwner {
        // NOTE: array lengths should be consistent across project names, project links, and units arrays
        // Get the array length for the project names array
        bytes memory data = loanTxData.getDataForTokenId(
            bytes32(tokenId),
            _NYX_VERIFIED_PROJECT_NAMES
        );
        uint128 arrayLength = abi.decode(data, (uint128));

        // Use the current array length to generate the array index keys for the new project
        bytes32 projectNameIndexKey = createLSP2ArrayIndexKey(
            _NYX_VERIFIED_PROJECT_NAMES,
            arrayLength
        );

        bytes32 projectLinkIndexKey = createLSP2ArrayIndexKey(
            _NYX_VERIFIED_PROJECT_LINKS,
            arrayLength
        );

        bytes32 unitsIndexKey = createLSP2ArrayIndexKey(
            _NYX_VERIFIED_PROJECT_UNITS,
            arrayLength
        );

        bytes32 geographicIdentifierIndexKey = createLSP2ArrayIndexKey(
            _NYX_VERIFIED_PROJECT_GEOGRAPHIC_IDENTIFIERS,
            arrayLength
        );

        emit ProjectAdded(
            projectName,
            projectLink,
            units,
            geographicIdentifier,
            arrayLength
        );

        // Save the new project to the appropriate keys
        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            projectNameIndexKey,
            bytes(projectName)
        );

        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            projectLinkIndexKey,
            bytes(projectLink)
        );

        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            unitsIndexKey,
            abi.encode(units)
        );

        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            geographicIdentifierIndexKey,
            bytes(geographicIdentifier)
        );

        // Increment the array length for the new project
        arrayLength += 1;

        // Save the new array length for all 4 arrays
        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_VERIFIED_PROJECT_NAMES,
            abi.encode(arrayLength)
        );

        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_VERIFIED_PROJECT_LINKS,
            abi.encode(arrayLength)
        );

        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_VERIFIED_PROJECT_UNITS,
            abi.encode(arrayLength)
        );

        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_VERIFIED_PROJECT_GEOGRAPHIC_IDENTIFIERS,
            abi.encode(arrayLength)
        );
    }

    function getVerifiedProject(
        uint256 tokenId,
        uint128 arrayIndex
    ) public view returns (bytes[] memory dataValues) {
        bytes32 projectNameIndexKey = createLSP2ArrayIndexKey(
            _NYX_VERIFIED_PROJECT_NAMES,
            arrayIndex
        );

        bytes32 projectLinkIndexKey = createLSP2ArrayIndexKey(
            _NYX_VERIFIED_PROJECT_LINKS,
            arrayIndex
        );

        bytes32 unitsIndexKey = createLSP2ArrayIndexKey(
            _NYX_VERIFIED_PROJECT_UNITS,
            arrayIndex
        );

        bytes32 geographicIdentifierIndexKey = createLSP2ArrayIndexKey(
            _NYX_VERIFIED_PROJECT_GEOGRAPHIC_IDENTIFIERS,
            arrayIndex
        );

        bytes32[] memory tokenIds = new bytes32[](4);
        bytes32[] memory dataKeys = new bytes32[](4);

        tokenIds[0] = bytes32(tokenId);
        tokenIds[1] = bytes32(tokenId);
        tokenIds[2] = bytes32(tokenId);
        tokenIds[3] = bytes32(tokenId);

        dataKeys[0] = projectNameIndexKey;
        dataKeys[1] = projectLinkIndexKey;
        dataKeys[2] = unitsIndexKey;
        dataKeys[3] = geographicIdentifierIndexKey;

        bytes[] memory data = loanTxData.getDataBatchForTokenIds(
            tokenIds,
            dataKeys
        );
        return (data);
    }

    function updateVerifiedProjectElement(
        uint256 tokenId,
        uint128 arrayIndex,
        bytes32 dataKey,
        bytes memory dataValue
    ) public onlyOwner {
        emit ProjectElementUpdated(tokenId, arrayIndex, dataKey, dataValue);

        bytes32 dataIndexKey = createLSP2ArrayIndexKey(dataKey, arrayIndex);

        loanTxData.setDataForTokenId(bytes32(tokenId), dataIndexKey, dataValue);
    }

    // LOAN FUNCTIONS
    function createLoan(
        LoanParams memory loanParams
    ) public onlyOwner returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        emit LoanCreated(newTokenId);

        // Call mintNFT
        loanTxData.mintNFT(
            newTokenId,
            loanParams.initialLoanAmount,
            loanParams.apy,
            loanParams.amortizationPeriodInMonths,
            loanParams.gracePeriodInMonths,
            loanParams.transactionBps,
            loanParams.lender,
            loanParams.borrower,
            loanParams.carbonCreditsStaked
        );

        loanTxData.setDataForTokenId(
            bytes32(newTokenId),
            _NYX_LOAN_BALANCE,
            abi.encode(
                LoanMath.calculateTotalLoanValue(
                    loanParams.initialLoanAmount * 1e18,
                    loanParams.apy * 1e18
                )
            )
        );

        loanTxData.setDataForTokenId(
            bytes32(newTokenId),
            _NYX_LOAN_STATUS,
            abi.encode(LoanState.Taken)
        );

        return newTokenId;
    }

    function evaluateSwapState(
        uint256 tokenId
    )
        public
        onlyOwner
        onlyInStates(tokenId, LoanState.Taken, LoanState.Swappable)
        nonReentrant(tokenId)
    {
        uint256 initialLoanAmount = loanTxData.getDecodedUint256(
            tokenId,
            _NYX_INITIAL_LOAN_AMOUNT
        );

        int256 carbonCreditBalance = loanTxData.getDecodedInt256(
            tokenId,
            _NYX_CARBON_CREDITS_BALANCE
        );

        int256 profit = LoanMath.calculateProfit(
            initialLoanAmount,
            carbonCreditBalance,
            carbonCreditPrice
        );

        int256 profitPercentage = (profit * 10000) / int(initialLoanAmount);

        // Determine the next state first without making any external calls
        LoanState nextState;
        if (profitPercentage > 5300) {
            nextState = LoanState.Swappable;
        } else if (profitPercentage > 3200) {
            emit LoanSwappable(carbonCreditBalance, profit, profitPercentage);
            nextState = LoanState.Swappable;
        } else {
            emit LoanNotSwappable(
                carbonCreditBalance,
                profit,
                profitPercentage
            );
            nextState = LoanState.Taken;
        }

        // Update the state before making external calls
        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_LOAN_STATUS,
            abi.encode(nextState)
        );

        // Execute external call after state update
        if (profitPercentage > 5300) {
            tokenLocks[tokenId] = false;
            executeSwap(tokenId);
            tokenLocks[tokenId] = true;
        }
    }

    function executeSwap(
        uint256 tokenId
    )
        public
        onlyOwner
        onlyInState(tokenId, LoanState.Swappable)
        nonReentrant(tokenId)
    {
        uint256 initialLoanAmount = loanTxData.getDecodedUint256(
            tokenId,
            _NYX_INITIAL_LOAN_AMOUNT
        );

        int256 carbonCreditBalance = loanTxData.getDecodedInt256(
            tokenId,
            _NYX_CARBON_CREDITS_BALANCE
        );

        int256 profit = LoanMath.calculateProfit(
            initialLoanAmount,
            carbonCreditBalance,
            carbonCreditPrice
        );

        int256 profitPercentage = (profit * 10000) / int(initialLoanAmount);

        // Check the profit threshold first before making any state changes
        if (profitPercentage <= 3200) {
            loanTxData.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Taken)
            );
            emit LoanNoLongerSwappable(profitPercentage);
            return;
        }

        address lender = loanTxData.getDecodedAddress(tokenId, _NYX_LENDER);

        // Update the state before any external interactions
        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_LOAN_BALANCE,
            abi.encode(0)
        );

        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_CARBON_CREDITS_BALANCE,
            abi.encode(0)
        );

        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_LOAN_STATUS,
            abi.encode(LoanState.Swapped)
        );

        // Emit event after state update
        emit LoanSwapped(carbonCreditBalance, profit, profitPercentage);

        // Reset carbon credit token IDs array length for this loan NFT
        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_RWAV_TOKEN_IDS,
            abi.encode(uint128(0))
        );

        // Mint carbon credits and store token IDs
        bytes memory arrayLengthData = loanTxData.getDataForTokenId(
            bytes32(tokenId),
            _NYX_VERIFIED_PROJECT_NAMES
        );
        uint128 arrayLength = abi.decode(arrayLengthData, (uint128));
        if (arrayLength > 0) {
            mintCarbonCreditNFTs(tokenId, arrayLength, lender);
        }
    }

    function mintCarbonCreditNFTs(
        uint256 tokenId,
        uint128 arrayLength,
        address lender
    ) internal {
        uint128 currentTokenIdArrayLength = 0;
        for (uint128 i = 0; i < arrayLength; i++) {
            bytes32 projectNameIndexKey = createLSP2ArrayIndexKey(
                _NYX_VERIFIED_PROJECT_NAMES,
                i
            );

            bytes32 projectLinkIndexKey = createLSP2ArrayIndexKey(
                _NYX_VERIFIED_PROJECT_LINKS,
                i
            );

            bytes32 unitsIndexKey = createLSP2ArrayIndexKey(
                _NYX_VERIFIED_PROJECT_UNITS,
                i
            );

            bytes32 geographicIdentifierIndexKey = createLSP2ArrayIndexKey(
                _NYX_VERIFIED_PROJECT_GEOGRAPHIC_IDENTIFIERS,
                i
            );

            bytes memory projectName = loanTxData.getDataForTokenId(
                bytes32(tokenId),
                projectNameIndexKey
            );
            bytes memory projectLink = loanTxData.getDataForTokenId(
                bytes32(tokenId),
                projectLinkIndexKey
            );
            bytes memory units = loanTxData.getDataForTokenId(
                bytes32(tokenId),
                unitsIndexKey
            );

            bytes memory geographicIdentifier = loanTxData.getDataForTokenId(
                bytes32(tokenId),
                geographicIdentifierIndexKey
            );

            if (abi.decode(units, (uint256)) > 0) {
                uint256 mintedTokenId = rwaVerification.mintNFT(
                    lender,
                    string(projectName),
                    string(projectLink),
                    abi.decode(units, (uint256)),
                    string(geographicIdentifier)
                );

                // Store the minted token ID in the loan NFT metadata
                bytes32 tokenIdIndexKey = createLSP2ArrayIndexKey(
                    _NYX_RWAV_TOKEN_IDS,
                    currentTokenIdArrayLength
                );
                loanTxData.setDataForTokenId(
                    bytes32(tokenId),
                    tokenIdIndexKey,
                    abi.encode(mintedTokenId)
                );
                currentTokenIdArrayLength++;
            }
        }

        // Update the token ID array length in the loan NFT metadata
        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_RWAV_TOKEN_IDS,
            abi.encode(currentTokenIdArrayLength)
        );
    }

    function makePayment(
        uint256 tokenId
    )
        public
        virtual
        override
        onlyBorrower(tokenId)
        onlyInState(tokenId, LoanState.Taken)
        nonReentrant(tokenId)
    {
        uint256[] storage paymentSchedule = paymentSchedules[tokenId];
        uint256 amortizationPeriodInMonths = loanTxData.getDecodedUint256(
            tokenId,
            _NYX_AMORITIZATION_PERIOD
        );

        uint256 transactionBps = loanTxData.getDecodedUint256(
            tokenId,
            _NYX_TRANSACTION_BPS
        );

        uint256 paymentIndex = loanTxData.getDecodedUint256(
            tokenId,
            _NYX_PAYMENT_INDEX
        );

        uint256 loanCurrentBalance = loanTxData.getDecodedUint256(
            tokenId,
            _NYX_LOAN_BALANCE
        );

        if (
            paymentIndex >= amortizationPeriodInMonths ||
            loanCurrentBalance <= 0
        ) {
            revert ZeroBalanceOnLoan();
        }

        if (block.timestamp <= paymentSchedule[paymentIndex]) {
            revert PaymentNotDue(paymentSchedule[paymentIndex]);
        }

        (uint256 netMonthlyPayment, uint256 transactionFee) = LoanMath
            .calculateMonthlyPayment(
                loanCurrentBalance,
                transactionBps,
                amortizationPeriodInMonths - paymentIndex
            );

        // Update loan balance
        loanCurrentBalance -= (netMonthlyPayment + transactionFee);
        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_LOAN_BALANCE,
            abi.encode(loanCurrentBalance)
        );

        // Update payment index
        paymentIndex += 1;
        loanTxData.setDataForTokenId(
            bytes32(tokenId),
            _NYX_PAYMENT_INDEX,
            abi.encode(paymentIndex)
        );

        if (
            paymentIndex >= amortizationPeriodInMonths ||
            loanCurrentBalance <= 0
        ) {
            emit LoanRepayed();
            loanTxData.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Repayed)
            );
        }
    }
}
