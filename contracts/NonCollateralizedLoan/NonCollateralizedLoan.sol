// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import {INonCollateralizedLoan} from "./INonCollateralizedLoan.sol";
import {LSP7Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/presets/LSP7Mintable.sol";
import {PaymentNotDue, ZeroBalanceOnLoan, ActionNotAllowedInCurrentState, Unauthorized} from "./NonCollateralizedLoanErrors.sol";
import {LoanState} from "./LoanEnums.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract NonCollateralizedLoan is INonCollateralizedLoan {
    LSP7Mintable public token;

    LoanState public loanState;

    address payable public owner;
    address payable public lender;
    address payable public borrower;

    uint256 public initialLoanAmount;
    uint256 public totalLoanValue;
    uint256 public currentBalance;
    uint256 public apy;
    uint256 public amortizationPeriodInMonths;
    uint256 public lockUpPeriodInMonths;
    uint256 public transactionPercentage;

    address payable public tokenAddress;

    uint256[] public paymentSchedule;
    uint256 public paymentIndex;

    constructor(
        uint256 _initialLoanAmount,
        uint256 _apy,
        uint256 _amortizationPeriodInMonths,
        uint256 _lockUpPeriodInMonths,
        uint256 _transactionPercentage,
        address payable _tokenAddress,
        address payable _lender
    ) {
        initialLoanAmount = _initialLoanAmount * 1e18;
        apy = _apy * 1e18;
        amortizationPeriodInMonths = _amortizationPeriodInMonths;
        lockUpPeriodInMonths = _lockUpPeriodInMonths;
        transactionPercentage = _transactionPercentage;
        token = LSP7Mintable(_tokenAddress);
        owner = payable(msg.sender);
        lender = _lender;
        loanState = LoanState.Created;
    }

    // PERMISSIONS MODIFIERS
    modifier onlyInState(LoanState expectedState) {
        if (loanState != expectedState)
            revert ActionNotAllowedInCurrentState(loanState, expectedState);
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized(msg.sender);
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
        virtual
        override
        onlyLender
        onlyInState(LoanState.Created)
    {
        token.transfer(
            msg.sender,
            address(this),
            initialLoanAmount,
            true,
            "0x"
        );
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
        token.transfer(address(this), borrower, initialLoanAmount, true, "0x");
        loanState = LoanState.Taken;
        emit LoanAccepted(
            msg.sender,
            address(this),
            borrower,
            initialLoanAmount,
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

    function calculateTotalLoanValue() internal view returns (uint256) {
        uint256 intermediateValue = (((10000 + (apy / 1e16)) ** 3) / 10000);
        return ((initialLoanAmount) * intermediateValue) / 1e8;
    }

    function calculateMonthlyPayment()
        internal
        view
        returns (uint256, uint256)
    {
        uint256 monthlyPayment = (currentBalance / 1e16) /
            (amortizationPeriodInMonths - paymentIndex);

        uint256 fee = (monthlyPayment * transactionPercentage) / 10000;
        uint256 netMonthlyPayment = monthlyPayment - fee;

        return (netMonthlyPayment * 1e16, fee * 1e16);
    }

    function makePayment()
        public
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

        uint256 netMonthlyPayment;
        uint256 transactionFee;
        (netMonthlyPayment, transactionFee) = calculateMonthlyPayment();

        token.transfer(borrower, lender, netMonthlyPayment, true, "0x");
        emit PaymentMade(
            msg.sender,
            borrower,
            lender,
            netMonthlyPayment,
            true,
            "0x"
        );

        token.transfer(borrower, owner, transactionFee, true, "0x");
        emit PaymentMade(
            msg.sender,
            borrower,
            owner,
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
        token.transfer(address(this), lender, initialLoanAmount, true, "0x");
        loanState = LoanState.Liquidated;
        emit LoanLiquidated(
            msg.sender,
            lender,
            address(this),
            initialLoanAmount,
            true,
            "0x"
        );
        selfdestruct(lender);
    }
}
