// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import {INonCollateralizedLoanNative} from "./INonCollateralizedLoanNative.sol";
import {LSP7Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/presets/LSP7Mintable.sol";
import {PaymentNotDue, ZeroBalanceOnLoan, ActionNotAllowedInCurrentState, ActionNotAllowedInCurrentStates, Unauthorized} from "../NonCollateralizedLoanErrors.sol";
import {LoanState} from "../LoanEnums.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// Dev imports
import "hardhat/console.sol";

contract NonCollateralizedLoanNative is
    INonCollateralizedLoanNative,
    OwnableUpgradeable
{
    uint256 public balance; // the amount of the native protocol coin locked in the smart contract during funding

    LoanState public loanState; // state of the loan

    address payable public lender; // address who lent the amount
    address payable public borrower; // address who borrowed the amount

    uint256 public initialLoanAmount; // amount lent to the borrower
    uint256 public totalLoanValue; // amount lent to the borrower + interest
    uint256 public currentBalance; // remaining amount left to be paid of the totalLoanValue
    uint256 public apy; // interest rate
    uint256 public amortizationPeriodInMonths; // number of payment periods in months
    uint256 public lockUpPeriodInMonths; // number of months until the first payment is due
    uint256 public transactionBps; // transaction fee measured in basis points paid to the owner for origination

    uint256[] public paymentSchedule; // array of uints representing the dates when payments are due in Unix epoch time
    uint256 public paymentIndex; // keeps track of how many payments have been made

    int256 public carbonCreditsGenerated; // total number of carbon credits generated from the project
    int256 public carbonCreditBalance; // remaining number of carbon credits that can be swapped
    int256 public carbonCreditPrice; // price of carbon credits; updated weekly until the loan state is set to Repayed or Swapped

    function initialize(
        uint256 _initialLoanAmount,
        uint256 _apy,
        uint256 _amortizationPeriodInMonths,
        uint256 _lockUpPeriodInMonths,
        uint256 _transactionBps,
        address payable _lender,
        int256 _carbonCreditsGenerated
    ) public initializer {
        // Loan Data
        initialLoanAmount = _initialLoanAmount * 1e18;
        apy = _apy * 1e18;
        amortizationPeriodInMonths = _amortizationPeriodInMonths;
        lockUpPeriodInMonths = _lockUpPeriodInMonths;
        transactionBps = _transactionBps;
        lender = _lender;

        // Project Data
        carbonCreditsGenerated = _carbonCreditsGenerated;
        carbonCreditBalance = _carbonCreditsGenerated;

        // Initializing State
        loanState = LoanState.Created;
        paymentIndex = 0;

        // Initialize Parent Contracts
        __Ownable_init();
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // PERMISSIONS MODIFIERS
    modifier onlyInState(LoanState expectedState) {
        if (loanState != expectedState)
            revert ActionNotAllowedInCurrentState(loanState, expectedState);
        _;
    }

    modifier onlyInStates(LoanState expectedState1, LoanState expectedState2) {
        if (loanState != expectedState1 && loanState != expectedState2)
            revert ActionNotAllowedInCurrentStates(
                loanState,
                expectedState1,
                expectedState2
            );
        _;
    }

    modifier onlyLender() {
        if (msg.sender != lender) revert Unauthorized(msg.sender);
        _;
    }

    modifier onlyBorrower() {
        if (msg.sender != borrower) revert Unauthorized(msg.sender);
        _;
    }

    // LOAN FUNCTIONS
    function fundLoan()
        public
        payable
        virtual
        override
        onlyLender
        onlyInState(LoanState.Created)
    {
        require(
            msg.value == initialLoanAmount,
            "Amount in msg does not equal loan value"
        );
        balance += msg.value;
        totalLoanValue = calculateTotalLoanValue();
        currentBalance = totalLoanValue;
        loanState = LoanState.Funded;
        emit LoanFunded(
            msg.sender,
            lender,
            address(this),
            initialLoanAmount,
            true,
            "0x"
        );
    }

    function setBorrower(address _borrower) public onlyOwner {
        borrower = payable(_borrower);
    }

    function acceptLoan()
        public
        virtual
        override
        onlyBorrower
        onlyInState(LoanState.Funded)
    {
        uint256 amountToTransfer = balance;
        balance = 0; // Set the balance to zero before the transfer to prevent reentrancy

        (bool success, ) = payable(borrower).call{value: amountToTransfer}("");
        require(success, "Transfer failed");

        loanState = LoanState.Taken;

        emit LoanAccepted(
            msg.sender,
            address(this),
            borrower,
            amountToTransfer,
            true,
            "0x"
        );
    }

    function setPaymentSchedule(
        uint256[] memory _paymentSchedule
    ) public onlyOwner {
        paymentSchedule = _paymentSchedule;
        paymentIndex = 0;
    }

    function setPaymentIndex(uint256 _paymentIndex) public onlyOwner {
        paymentIndex = _paymentIndex;
    }

    function setCarbonCreditPrice(int256 _carbonCreditPrice) public onlyOwner {
        carbonCreditPrice = _carbonCreditPrice;
    }

    function calculateTotalLoanValue() internal view returns (uint256) {
        uint256 intermediateValue = (((10000 + (apy / 1e16)) ** 3) / 10000);
        return ((initialLoanAmount) * intermediateValue) / 1e8;
    }

    function calculateMonthlyPayment() public view returns (uint256, uint256) {
        uint256 monthlyPayment = (currentBalance) /
            (amortizationPeriodInMonths - paymentIndex);

        uint256 fee = (monthlyPayment * transactionBps) / 10000;
        uint256 netMonthlyPayment = monthlyPayment - fee;

        return (netMonthlyPayment, fee);
    }

    function calculateProfit() internal view returns (int256) {
        // calculate profit as remaining carbon credit balance * current price of carbon credits
        // divided by the initial loan amount
        return
            (carbonCreditBalance * carbonCreditPrice) - int(initialLoanAmount);
    }

    function evaluateSwapState()
        public
        onlyOwner
        onlyInStates(LoanState.Taken, LoanState.Swappable)
    {
        int256 profit = calculateProfit();
        int256 profitPercentage = (profit * 10000) / int(initialLoanAmount);

        // execute swap if profit percentage is greater than 53%
        // else place loan in swappable state
        if (profitPercentage > 5300) {
            loanState = LoanState.Swappable;
            executeSwap();
        } else if (profitPercentage > 3200) {
            loanState = LoanState.Swappable;
            emit LoanSwappable(carbonCreditBalance, profit, profitPercentage);
        } else {
            emit LoanNotSwappable(
                carbonCreditBalance,
                profit,
                profitPercentage
            );
        }
    }

    function executeSwap() public onlyOwner onlyInState(LoanState.Swappable) {
        int256 profit = calculateProfit();
        int256 profitPercentage = (profit * 10000) / int(initialLoanAmount);

        // Ensure the profit is still greater than 32% at time of execution
        if (profitPercentage <= 3200) {
            loanState = LoanState.Taken;
            emit LoanNoLongerSwappable(profitPercentage);
        } else {
            currentBalance = 0;
            loanState = LoanState.Swapped;
            emit LoanSwapped(carbonCreditBalance, profit, profitPercentage);
        }
    }

    function makePayment()
        public
        payable
        virtual
        override
        onlyBorrower
        onlyInState(LoanState.Taken)
    {
        if (paymentIndex >= amortizationPeriodInMonths || currentBalance <= 0) {
            revert ZeroBalanceOnLoan();
        }

        if (block.timestamp <= paymentSchedule[paymentIndex]) {
            revert PaymentNotDue(paymentSchedule[paymentIndex]);
        }

        (
            uint256 netMonthlyPayment,
            uint256 transactionFee
        ) = calculateMonthlyPayment();

        // Ensure the borrower has sent sufficient funds
        require(
            msg.value >= netMonthlyPayment + transactionFee,
            "Insufficient funds sent"
        );

        // Transfer netMonthlyPayment to the lender
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

        currentBalance -= (netMonthlyPayment + transactionFee);
        paymentIndex += 1;

        if (paymentIndex >= amortizationPeriodInMonths || currentBalance <= 0) {
            loanState = LoanState.Repayed;
            emit LoanRepayed();
        }
    }

    function liquidiateLoan()
        public
        virtual
        override
        onlyLender
        onlyInState(LoanState.Funded)
    {
        uint256 amount = balance;
        balance = 0; // Set balance to 0 before the external call

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Failed to liquidate loan");

        loanState = LoanState.Liquidated;
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
