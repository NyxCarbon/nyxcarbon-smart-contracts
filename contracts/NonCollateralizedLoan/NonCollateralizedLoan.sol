// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import {INonCollateralizedLoan} from "./INonCollateralizedLoan.sol";
import {LSP7Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/presets/LSP7Mintable.sol";
import {PaymentNotDue, ZeroBalanceOnLoan, ActionNotAllowedInCurrentState, Unauthorized} from "./NonCollateralizedLoanErrors.sol";
import {LoanState} from "./LoanEnums.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NonCollateralizedLoan is INonCollateralizedLoan, Ownable {
    LSP7Mintable public token;

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

    address payable public tokenAddress;

    uint256[] public paymentSchedule;
    uint256 public paymentIndex;

    constructor(
        uint256 _initialLoanAmount,
        uint256 _apy,
        uint256 _amortizationPeriodInMonths,
        uint256 _lockUpPeriodInMonths,
        uint256 _transactionBps,
        address payable _tokenAddress,
        address payable _lender
    ) {
        initialLoanAmount = _initialLoanAmount * 1e18;
        apy = _apy * 1e18;
        amortizationPeriodInMonths = _amortizationPeriodInMonths;
        lockUpPeriodInMonths = _lockUpPeriodInMonths;
        transactionBps = _transactionBps;
        token = LSP7Mintable(_tokenAddress);
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
        virtual
        override
        onlyLender
        onlyInState(LoanState.Created)
    {
        // Ensure that the sender has enough balance of the token
        require(
            token.balanceOf(msg.sender) >= initialLoanAmount,
            "Insufficient balance"
        );

        // Perform the token transfer
        token.transfer(
            msg.sender,
            address(this),
            initialLoanAmount,
            true,
            "0x"
        );

        // Calculate total loan value
        totalLoanValue = calculateTotalLoanValue();
        currentBalance = totalLoanValue;

        // Update loan state and emit event
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

        require(
            token.balanceOf(msg.sender) >= netMonthlyPayment + transactionFee,
            "Insufficient balance"
        );

        token.transfer(borrower, lender, netMonthlyPayment, true, "0x");
        emit PaymentMade(
            msg.sender,
            borrower,
            lender,
            netMonthlyPayment,
            true,
            "0x"
        );

        token.transfer(borrower, owner(), transactionFee, true, "0x");
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
