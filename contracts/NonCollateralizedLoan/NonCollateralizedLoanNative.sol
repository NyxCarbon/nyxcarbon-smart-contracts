// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import {INonCollateralizedLoanNative} from "./INonCollateralizedLoanNative.sol";
import {LSP7Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/presets/LSP7Mintable.sol";
import {PaymentNotDue, ZeroBalanceOnLoan, ActionNotAllowedInCurrentState, Unauthorized} from "./NonCollateralizedLoanErrors.sol";
import {LoanState} from "./LoanEnums.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NonCollateralizedLoanNative is INonCollateralizedLoanNative, Ownable {
    uint256 public balance;

    LoanState public loanState;

    address payable public lender;
    address payable public borrower;

    uint256 public initialLoanAmount;
    uint256 public totalLoanValue;
    uint256 public currentBalance;
    uint256 public apy;
    uint256 public amortizationPeriodInMonths;
    uint256 public lockUpPeriodInMonths;
    uint256 public transactionBps;

    uint256[] public paymentSchedule;
    uint256 public paymentIndex = 0;

    constructor(
        uint256 _initialLoanAmount,
        uint256 _apy,
        uint256 _amortizationPeriodInMonths,
        uint256 _lockUpPeriodInMonths,
        uint256 _transactionBps,
        address payable _lender
    ) {
        initialLoanAmount = _initialLoanAmount * 1e18;
        apy = _apy * 1e18;
        amortizationPeriodInMonths = _amortizationPeriodInMonths;
        lockUpPeriodInMonths = _lockUpPeriodInMonths;
        transactionBps = _transactionBps;
        lender = _lender;
        loanState = LoanState.Created;
    }

    // PERMISSIONS MODIFIERS
    modifier onlyInState(LoanState expectedState) {
        if (loanState != expectedState)
            revert ActionNotAllowedInCurrentState(loanState, expectedState);
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
