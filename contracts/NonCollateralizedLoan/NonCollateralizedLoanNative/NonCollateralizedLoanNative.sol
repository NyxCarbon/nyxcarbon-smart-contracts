// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

// modules
import {INonCollateralizedLoanNative} from "./INonCollateralizedLoanNative.sol";
import {NonCollateralizedLoanNFT} from "../NonCollateralizedLoanNFT/NonCollaterlizedLoanNFT.sol";
import {CarbonCreditNFTCollection} from "../../CarbonCreditNFTCollection/CarbonCreditNFTCollection.sol";
import {PaymentNotDue, ZeroBalanceOnLoan, ActionNotAllowedInCurrentState, ActionNotAllowedInCurrentStates, Unauthorized} from "../NonCollateralizedLoanErrors.sol";
import {LoanState} from "../LoanEnums.sol";
import "../LoanMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// constants
import {_NYX_INITIAL_LOAN_AMOUNT, _NYX_LOAN_APY, _NYX_AMORITIZATION_PERIOD, _NYX_LOCKUP_PERIOD, _NYX_TRANSACTION_BPS, _NYX_TOKEN_ADDRESS, _NYX_LENDER, _NYX_BORROWER, _NYX_CARBON_CREDITS_GENERATED, _NYX_CARBON_CREDITS_BALANCE, _NYX_CARBON_CREDITS_PRICE, _NYX_LOAN_BALANCE, _NYX_LOAN_STATUS, _NYX_PAYMENT_INDEX, _NYX_CADT_PROJECT_NAME, _NYX_CADT_REGISTRY_LINK} from "../NonCollateralizedLoanNFT/constants.sol";

contract NonCollateralizedLoanNative is INonCollateralizedLoanNative, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    NonCollateralizedLoanNFT public loanNFTContract;
    CarbonCreditNFTCollection public carbonCreditNFTContract;

    int256 public carbonCreditPrice;
    mapping(uint256 => uint256) public balance;
    mapping(uint256 => uint256[]) public paymentSchedules;

    constructor(
        address payable loanNFTContractAddress,
        address payable carbonCreditNFTContractAddress
    ) {
        loanNFTContract = NonCollateralizedLoanNFT(loanNFTContractAddress);
        carbonCreditNFTContract = CarbonCreditNFTCollection(
            carbonCreditNFTContractAddress
        );
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

    function setCarbonCreditPrice(int256 _carbonCreditPrice) public onlyOwner {
        carbonCreditPrice = _carbonCreditPrice;
    }

    function setBorrower(uint256 tokenId, address _borrower) public onlyOwner {
        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_BORROWER,
            abi.encode(_borrower)
        );
    }

    function getPaymentSchedule(
        uint256 tokenId
    ) public view returns (uint256[] memory) {
        return paymentSchedules[tokenId];
    }

    function setPaymentSchedule(
        uint256 tokenId,
        uint256[] memory _paymentSchedule
    ) public onlyOwner {
        paymentSchedules[tokenId] = _paymentSchedule;
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

        return
            LoanMath.calculateMonthlyPayment(
                loanCurrentBalance,
                transactionBps,
                amortizationPeriodInMonths - paymentIndex
            );
    }

    // LOAN FUNCTIONS
    function createLoan(
        LoanParams memory loanParams,
        string memory _cadtProjectName,
        string memory _cadtRegistryLink
    ) public onlyOwner returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        // Call mintNFT
        loanNFTContract.mintNFT(
            newTokenId,
            loanParams.initialLoanAmount,
            loanParams.apy,
            loanParams.amortizationPeriodInMonths,
            loanParams.lockUpPeriodInMonths,
            loanParams.transactionBps,
            loanParams.lender,
            loanParams.borrower,
            loanParams.carbonCreditsGenerated,
            _cadtProjectName,
            _cadtRegistryLink
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

        emit LoanCreated(newTokenId);
        return newTokenId;
    }

    function fundLoan(
        uint256 tokenId
    )
        public
        payable
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

        // Ensure that the tx contains enough LYX to fund the loan
        require(
            msg.value == initialLoanAmount,
            "Amount in msg does not equal loan value"
        );

        // Add LYX to contract storage
        balance[tokenId] += msg.value;

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

        // Emit event indicating loan has been funded
        emit LoanFunded(
            msg.sender,
            lender,
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
        uint256 amountToTransfer = balance[tokenId];
        balance[tokenId] = 0; // Set the balance to zero before the transfer to prevent reentrancy

        // Retrieve borrower from ERC725Y
        address borrower = loanNFTContract.getDecodedAddress(
            tokenId,
            _NYX_BORROWER
        );

        (bool success, ) = payable(borrower).call{value: amountToTransfer}("");
        require(success, "Transfer failed");

        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_LOAN_STATUS,
            abi.encode(LoanState.Taken)
        );

        emit LoanAccepted(
            msg.sender,
            address(this),
            borrower,
            amountToTransfer,
            true,
            "0x"
        );
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
        // else place loan in swappable state
        if (profitPercentage > 5300) {
            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Swappable)
            );
            executeSwap(tokenId);
        } else if (profitPercentage > 3200) {
            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Swappable)
            );
            emit LoanSwappable(carbonCreditBalance, profit, profitPercentage);
        } else {
            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Taken)
            );
            emit LoanNotSwappable(
                carbonCreditBalance,
                profit,
                profitPercentage
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
            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Taken)
            );

            emit LoanNoLongerSwappable(profitPercentage);
        } else {
            // Get CADT project name, CADT registry link, and lender address
            string memory cadtProjectName = loanNFTContract.getDecodedString(
                tokenId,
                _NYX_CADT_PROJECT_NAME
            );

            string memory cadtRegistryLink = loanNFTContract.getDecodedString(
                tokenId,
                _NYX_CADT_REGISTRY_LINK
            );

            address lender = loanNFTContract.getDecodedAddress(
                tokenId,
                _NYX_LENDER
            );

            // Mint carbon credit NFT
            carbonCreditNFTContract.mintCarbonCreditNFT(
                lender,
                cadtProjectName,
                cadtRegistryLink,
                carbonCreditBalance
            );

            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_BALANCE,
                abi.encode(0)
            );
            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Swapped)
            );
            emit LoanSwapped(carbonCreditBalance, profit, profitPercentage);
        }
    }

    function makePayment(
        uint256 tokenId
    )
        public
        payable
        virtual
        override
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

        // Ensure the borrower has sent sufficient funds
        require(
            msg.value >= netMonthlyPayment + transactionFee,
            "Insufficient funds sent"
        );

        // Transfer netMonthlyPayment to the lender
        address lender = loanNFTContract.getDecodedAddress(
            tokenId,
            _NYX_LENDER
        );
        address borrower = loanNFTContract.getDecodedAddress(
            tokenId,
            _NYX_BORROWER
        );

        payable(lender).transfer(netMonthlyPayment);
        emit PaymentMade(
            msg.sender,
            borrower,
            lender,
            netMonthlyPayment,
            true,
            "0x"
        );

        // Transfer transactionFee to the owner
        payable(owner()).transfer(transactionFee);
        emit PaymentMade(
            msg.sender,
            borrower,
            owner(),
            transactionFee,
            true,
            "0x"
        );

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
            loanNFTContract.setDataForTokenId(
                bytes32(tokenId),
                _NYX_LOAN_STATUS,
                abi.encode(LoanState.Repayed)
            );
            emit LoanRepayed();
        }
    }

    function liquidiateLoan(
        uint256 tokenId
    )
        public
        virtual
        override
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

        uint256 amount = balance[tokenId];
        balance[tokenId] = 0; // Set balance to 0 before the external call

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Failed to liquidate loan");

        loanNFTContract.setDataForTokenId(
            bytes32(tokenId),
            _NYX_LOAN_STATUS,
            abi.encode(LoanState.Liquidated)
        );

        emit LoanLiquidated(
            msg.sender,
            lender,
            address(this),
            initialLoanAmount,
            true,
            "0x"
        );
    }
}
