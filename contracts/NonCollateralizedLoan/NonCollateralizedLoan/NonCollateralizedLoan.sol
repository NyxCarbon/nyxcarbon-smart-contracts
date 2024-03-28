// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

// modules
import {INonCollateralizedLoan} from "./INonCollateralizedLoan.sol";
import {NonCollateralizedLoanNFT} from "../NonCollateralizedLoanNFT/NonCollaterlizedLoanNFT.sol";
import {CarbonCreditNFTCollection} from "../../CarbonCreditNFTCollection/CarbonCreditNFTCollection.sol";
import {PaymentNotDue, ZeroBalanceOnLoan, ActionNotAllowedInCurrentState, ActionNotAllowedInCurrentStates, Unauthorized} from "../NonCollateralizedLoanErrors.sol";
import {LSP7Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/presets/LSP7Mintable.sol";
import {LoanState} from "../LoanEnums.sol";
import "../LoanMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// constants
import {_NYX_INITIAL_LOAN_AMOUNT, _NYX_LOAN_APY, _NYX_AMORITIZATION_PERIOD, _NYX_GRACE_PERIOD, _NYX_TRANSACTION_BPS, _NYX_TOKEN_ADDRESS, _NYX_LENDER, _NYX_BORROWER, _NYX_CARBON_CREDITS_STAKED, _NYX_CARBON_CREDITS_BALANCE, _NYX_CARBON_CREDITS_PRICE, _NYX_LOAN_BALANCE, _NYX_LOAN_STATUS, _NYX_PAYMENT_INDEX, _NYX_CADT_PROJECT_NAMES, _NYX_CADT_REGISTRY_LINKS, _NYX_CADT_UNITS} from "../NonCollateralizedLoanNFT/constants.sol";

contract NonCollateralizedLoan is INonCollateralizedLoan, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    NonCollateralizedLoanNFT public immutable loanNFTContract;
    CarbonCreditNFTCollection public immutable carbonCreditNFTContract;
    LSP7Mintable public immutable token;

    int256 public carbonCreditPrice;
    mapping(uint256 => uint256[]) public paymentSchedules;

    constructor(
        address payable loanNFTContractAddress,
        address payable carbonCreditNFTContractAddress,
        address payable tokenAddress
    ) {
        loanNFTContract = NonCollateralizedLoanNFT(loanNFTContractAddress);
        carbonCreditNFTContract = CarbonCreditNFTCollection(
            carbonCreditNFTContractAddress
        );
        token = LSP7Mintable(tokenAddress);
    }

    // PERMISSIONS MODIFIERS
    modifier onlyInState(uint256 tokenId, LoanState expectedState) {
        LoanState currentLoanState = LoanState(
            loanNFTContract.getDecodedUint256(tokenId, _NYX_LOAN_STATUS)
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
            loanNFTContract.getDecodedUint256(tokenId, _NYX_LOAN_STATUS)
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
        if (
            msg.sender !=
            loanNFTContract.getDecodedAddress(tokenId, _NYX_LENDER)
        ) revert Unauthorized(msg.sender);
        _;
    }

    modifier onlyBorrower(uint256 tokenId) {
        if (
            msg.sender !=
            loanNFTContract.getDecodedAddress(tokenId, _NYX_BORROWER)
        ) revert Unauthorized(msg.sender);
        _;
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
        loanNFTContract.setDataForTokenId(bytes32(tokenId), dataKey, dataValue);
    }

    function calculatePayment(
        uint256 tokenId
    ) public view returns (uint256, uint256) {
        uint256 amortizationPeriodInMonths = loanNFTContract.getDecodedUint256(
            tokenId,
            _NYX_AMORITIZATION_PERIOD
        );

        uint256 transactionBps = loanNFTContract.getDecodedUint256(
            tokenId,
            _NYX_TRANSACTION_BPS
        );

        uint256 paymentIndex = loanNFTContract.getDecodedUint256(
            tokenId,
            _NYX_PAYMENT_INDEX
        );

        uint256 loanCurrentBalance = loanNFTContract.getDecodedUint256(
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

    function addCADTProject(
        uint256 tokenId,
        string memory projectName,
        string memory registryLink,
        uint256 units
    ) public onlyOwner {
        // NOTE: array lengths should be consistent across project names, registry links, and units arrays
        // Get the array length for the project names array
        bytes memory data = loanNFTContract.getDataForTokenId(
            bytes32(tokenId),
            _NYX_CADT_PROJECT_NAMES
        );
        uint128 arrayLength = abi.decode(data, (uint128));

        // Use the current array length to generate the array index keys for the new project
        bytes32 projectNameIndexKey = createLSP2ArrayIndexKey(
            _NYX_CADT_PROJECT_NAMES,
            arrayLength
        );

        bytes32 registryLinkIndexKey = createLSP2ArrayIndexKey(
            _NYX_CADT_REGISTRY_LINKS,
            arrayLength
        );

        bytes32 unitsIndexKey = createLSP2ArrayIndexKey(
            _NYX_CADT_UNITS,
            arrayLength
        );

        emit ProjectAdded(projectName, registryLink, units, arrayLength);

        // Save the new project to the appropriate keys
        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            projectNameIndexKey,
            bytes(projectName)
        );

        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            registryLinkIndexKey,
            bytes(registryLink)
        );

        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            unitsIndexKey,
            abi.encode(units)
        );

        // Increment the array length for the new project
        arrayLength += 1;

        // Save the new array length for all 3 arrays
        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_CADT_PROJECT_NAMES,
            abi.encode(arrayLength)
        );

        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_CADT_REGISTRY_LINKS,
            abi.encode(arrayLength)
        );

        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_CADT_UNITS,
            abi.encode(arrayLength)
        );
    }

    function getCADTProject(
        uint256 tokenId,
        uint128 arrayIndex
    ) public view returns (bytes[] memory dataValues) {
        bytes32 projectNameIndexKey = createLSP2ArrayIndexKey(
            _NYX_CADT_PROJECT_NAMES,
            arrayIndex
        );

        bytes32 registryLinkIndexKey = createLSP2ArrayIndexKey(
            _NYX_CADT_REGISTRY_LINKS,
            arrayIndex
        );

        bytes32 unitsIndexKey = createLSP2ArrayIndexKey(
            _NYX_CADT_UNITS,
            arrayIndex
        );

        bytes32[] memory tokenIds = new bytes32[](3);
        bytes32[] memory dataKeys = new bytes32[](3);

        tokenIds[0] = bytes32(tokenId);
        tokenIds[1] = bytes32(tokenId);
        tokenIds[2] = bytes32(tokenId);

        dataKeys[0] = projectNameIndexKey;
        dataKeys[1] = registryLinkIndexKey;
        dataKeys[2] = unitsIndexKey;

        bytes[] memory data = loanNFTContract.getDataBatchForTokenIds(
            tokenIds,
            dataKeys
        );
        return (data);
    }

    function updateCADTProjectElement(
        uint256 tokenId,
        uint128 arrayIndex,
        bytes32 dataKey,
        bytes memory dataValue
    ) public onlyOwner {
        emit ProjectElementUpdated(tokenId, arrayIndex, dataKey, dataValue);

        bytes32 dataIndexKey = createLSP2ArrayIndexKey(dataKey, arrayIndex);

        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            dataIndexKey,
            dataValue
        );
    }

    // LOAN FUNCTIONS
    function createLoan(
        LoanParams memory loanParams
    ) public onlyOwner returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        emit LoanCreated(newTokenId);

        // Call mintNFT
        loanNFTContract.mintNFT(
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

        loanNFTContract.setDataForTokenId(
            bytes32(newTokenId),
            _NYX_LOAN_BALANCE,
            abi.encode(
                LoanMath.calculateTotalLoanValue(
                    loanParams.initialLoanAmount * 1e18,
                    loanParams.apy * 1e18
                )
            )
        );

        loanNFTContract.setDataForTokenId(
            bytes32(newTokenId),
            _NYX_LOAN_STATUS,
            abi.encode(LoanState.Created)
        );

        return newTokenId;
    }

    function fundLoan(
        uint256 tokenId
    )
        public
        virtual
        override
        onlyLender(tokenId)
        onlyInState(tokenId, LoanState.Created)
    {
        // Retrieve NFT metadata from ERC725Y
        uint256 initialLoanAmount = loanNFTContract.getDecodedUint256(
            tokenId,
            _NYX_INITIAL_LOAN_AMOUNT
        );
        uint256 apy = loanNFTContract.getDecodedUint256(tokenId, _NYX_LOAN_APY);
        address lender = loanNFTContract.getDecodedAddress(
            tokenId,
            _NYX_LENDER
        );

        // Ensure that the sender has enough balance of the token
        require(
            token.balanceOf(msg.sender) >= initialLoanAmount,
            "Insufficient balance"
        );

        // Emit event indicating loan has been funded
        emit LoanFunded(
            msg.sender,
            lender,
            address(this),
            initialLoanAmount,
            true,
            "0x"
        );

        // Calculate total loan value and update _NYX_LOAN_BALANCE and _NYX_LOAN_STATUS
        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_LOAN_BALANCE,
            abi.encode(LoanMath.calculateTotalLoanValue(initialLoanAmount, apy))
        );

        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_LOAN_STATUS,
            abi.encode(LoanState.Funded)
        );

        // Perform the token transfer
        token.transfer(
            msg.sender,
            address(this),
            initialLoanAmount,
            true,
            "0x"
        );
    }

    function acceptLoan(
        uint256 tokenId
    )
        public
        virtual
        override
        onlyBorrower(tokenId)
        onlyInState(tokenId, LoanState.Funded)
    {
        uint256 initialLoanAmount = loanNFTContract.getDecodedUint256(
            tokenId,
            _NYX_INITIAL_LOAN_AMOUNT
        );

        address borrower = loanNFTContract.getDecodedAddress(
            tokenId,
            _NYX_BORROWER
        );

        emit LoanAccepted(
            msg.sender,
            address(this),
            borrower,
            initialLoanAmount,
            true,
            "0x"
        );

        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_LOAN_STATUS,
            abi.encode(LoanState.Taken)
        );

        token.transfer(address(this), borrower, initialLoanAmount, true, "0x");
    }

    function evaluateSwapState(
        uint256 tokenId
    )
        public
        onlyOwner
        onlyInStates(tokenId, LoanState.Taken, LoanState.Swappable)
    {
        uint256 initialLoanAmount = loanNFTContract.getDecodedUint256(
            tokenId,
            _NYX_INITIAL_LOAN_AMOUNT
        );

        int256 carbonCreditBalance = loanNFTContract.getDecodedInt256(
            tokenId,
            _NYX_CARBON_CREDITS_BALANCE
        );

        int256 profit = LoanMath.calculateProfit(
            initialLoanAmount,
            carbonCreditBalance,
            carbonCreditPrice
        );

        int256 profitPercentage = (profit * 10000) / int(initialLoanAmount);

        // execute swap if profit percentage is greater than 53%
        // else place loan in swappable state if loan is greater than 32%
        if (profitPercentage > 5300) {
            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Swappable)
            );
            executeSwap(tokenId);
        } else if (profitPercentage > 3200) {
            emit LoanSwappable(carbonCreditBalance, profit, profitPercentage);
            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Swappable)
            );
        } else {
            emit LoanNotSwappable(
                carbonCreditBalance,
                profit,
                profitPercentage
            );
            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Taken)
            );
        }
    }

    function executeSwap(
        uint256 tokenId
    ) public onlyOwner onlyInState(tokenId, LoanState.Swappable) {
        uint256 initialLoanAmount = loanNFTContract.getDecodedUint256(
            tokenId,
            _NYX_INITIAL_LOAN_AMOUNT
        );

        int256 carbonCreditBalance = loanNFTContract.getDecodedInt256(
            tokenId,
            _NYX_CARBON_CREDITS_BALANCE
        );

        int256 profit = LoanMath.calculateProfit(
            initialLoanAmount,
            carbonCreditBalance,
            carbonCreditPrice
        );

        int256 profitPercentage = (profit * 10000) / int(initialLoanAmount);

        // Ensure the profit is still greater than 32% at time of execution
        if (profitPercentage <= 3200) {
            emit LoanNoLongerSwappable(profitPercentage);
            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Taken)
            );
        } else {
            emit LoanSwapped(carbonCreditBalance, profit, profitPercentage);

            address lender = loanNFTContract.getDecodedAddress(
                tokenId,
                _NYX_LENDER
            );

            // Get the array length for the project names array
            bytes memory arrayLengthData = loanNFTContract.getDataForTokenId(
                bytes32(tokenId),
                _NYX_CADT_PROJECT_NAMES
            );
            uint128 arrayLength = abi.decode(arrayLengthData, (uint128));
            if (arrayLength > 0) {
                mintCarbonCreditNFTs(tokenId, arrayLength, lender);
            }

            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_BALANCE,
                abi.encode(0)
            );

            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_CARBON_CREDITS_BALANCE,
                abi.encode(0)
            );

            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Swapped)
            );
        }
    }

    function mintCarbonCreditNFTs(
        uint256 tokenId,
        uint128 arrayLength,
        address lender
    ) internal {
        for (uint128 i = 0; i < arrayLength; i++) {
            bytes32 projectNameIndexKey = createLSP2ArrayIndexKey(
                _NYX_CADT_PROJECT_NAMES,
                i
            );

            bytes32 registryLinkIndexKey = createLSP2ArrayIndexKey(
                _NYX_CADT_REGISTRY_LINKS,
                i
            );

            bytes32 unitsIndexKey = createLSP2ArrayIndexKey(_NYX_CADT_UNITS, i);

            bytes memory projectName = loanNFTContract.getDataForTokenId(
                bytes32(tokenId),
                projectNameIndexKey
            );
            bytes memory registryLink = loanNFTContract.getDataForTokenId(
                bytes32(tokenId),
                registryLinkIndexKey
            );
            bytes memory units = loanNFTContract.getDataForTokenId(
                bytes32(tokenId),
                unitsIndexKey
            );

            if (abi.decode(units, (uint256)) > 0) {
                carbonCreditNFTContract.mintCarbonCreditNFT(
                    lender,
                    string(projectName),
                    string(registryLink),
                    abi.decode(units, (uint256))
                );
            }
        }
    }

    function makePayment(
        uint256 tokenId
    )
        public
        virtual
        onlyBorrower(tokenId)
        onlyInState(tokenId, LoanState.Taken)
    {
        uint256[] storage paymentSchedule = paymentSchedules[tokenId];

        uint256 amortizationPeriodInMonths = loanNFTContract.getDecodedUint256(
            tokenId,
            _NYX_AMORITIZATION_PERIOD
        );

        uint256 transactionBps = loanNFTContract.getDecodedUint256(
            tokenId,
            _NYX_TRANSACTION_BPS
        );

        uint256 paymentIndex = loanNFTContract.getDecodedUint256(
            tokenId,
            _NYX_PAYMENT_INDEX
        );

        uint256 loanCurrentBalance = loanNFTContract.getDecodedUint256(
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

        require(
            token.balanceOf(msg.sender) >= netMonthlyPayment + transactionFee,
            "Insufficient balance"
        );

        payLender(tokenId, netMonthlyPayment);
        payOriginator(tokenId, transactionFee);

        // Update loan balance
        loanCurrentBalance -= (netMonthlyPayment + transactionFee);
        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_LOAN_BALANCE,
            abi.encode(loanCurrentBalance)
        );

        // Update payment index
        paymentIndex += 1;
        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_PAYMENT_INDEX,
            abi.encode(paymentIndex)
        );

        if (
            paymentIndex >= amortizationPeriodInMonths ||
            loanCurrentBalance <= 0
        ) {
            emit LoanRepayed();
            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Repayed)
            );
        }
    }

    function payLender(uint256 tokenId, uint256 amount) public virtual {
        address lender = loanNFTContract.getDecodedAddress(
            tokenId,
            _NYX_LENDER
        );
        address borrower = loanNFTContract.getDecodedAddress(
            tokenId,
            _NYX_BORROWER
        );

        emit PaymentMade(msg.sender, borrower, lender, amount, true, "0x");
        token.transfer(borrower, lender, amount, true, "0x");
    }

    function payOriginator(uint256 tokenId, uint256 fee) public virtual {
        address borrower = loanNFTContract.getDecodedAddress(
            tokenId,
            _NYX_BORROWER
        );

        emit PaymentMade(msg.sender, borrower, owner(), fee, true, "0x");
        token.transfer(borrower, owner(), fee, true, "0x");
    }

    function liquidiateLoan(
        uint256 tokenId
    )
        public
        virtual
        onlyLender(tokenId)
        onlyInState(tokenId, LoanState.Funded)
    {
        uint256 initialLoanAmount = loanNFTContract.getDecodedUint256(
            tokenId,
            _NYX_INITIAL_LOAN_AMOUNT
        );

        address lender = loanNFTContract.getDecodedAddress(
            tokenId,
            _NYX_LENDER
        );

        emit LoanLiquidated(
            msg.sender,
            lender,
            address(this),
            initialLoanAmount,
            true,
            "0x"
        );

        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_LOAN_STATUS,
            abi.encode(LoanState.Liquidated)
        );

        token.transfer(address(this), lender, initialLoanAmount, true, "0x");
    }
}
