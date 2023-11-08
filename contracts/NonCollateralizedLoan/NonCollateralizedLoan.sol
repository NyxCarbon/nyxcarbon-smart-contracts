// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import {LSP7Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/presets/LSP7Mintable.sol";
import {PaymentNotDue, ZeroBalanceOnLoan, ActionNotAllowedInCurrentState} from "./NonCollateralizedLoanErrors.sol";
import {LoanState} from "./LoanEnums.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";

contract NonCollateralizedLoan {
    using SafeMath for uint256;

    LSP7Mintable public token;

    LoanState public loanState;

    address payable public lender;
    address payable public borrower;
    address payable public nyxCarbonAddress;

    uint256 public initialLoanAmount;
    uint256 public currentBalance;
    uint256 public apy;
    uint256 public amortizationPeriodInMonths;
    uint256 public lockUpPeriodInMonths;
    uint256 public transactionPercentage;

    address payable public tokenAddress;

    uint256[] public paymentSchedule;
    uint256 public paymentIndex;
    uint256 public netMonthlyPayment;
    uint256 public transactionFee;

    constructor(
        uint256 _initialLoanAmount,
        uint256 _apy,
        uint256 _amortizationPeriodInMonths,
        uint256 _lockUpPeriodInMonths,
        uint256 _transactionPercentage,
        address payable _tokenAddress,
        address payable _nyxCarbonAddress
    ) {
        initialLoanAmount = _initialLoanAmount * 1e18;
        apy = _apy * 1e18;
        amortizationPeriodInMonths = _amortizationPeriodInMonths;
        lockUpPeriodInMonths = _lockUpPeriodInMonths;
        transactionPercentage = _transactionPercentage;
        token = LSP7Mintable(_tokenAddress);
        nyxCarbonAddress = _nyxCarbonAddress;
        lender = payable(msg.sender);
        loanState = LoanState.Created;
    }

    modifier onlyInState(LoanState expectedState) {
        if (loanState != expectedState) {
            revert ActionNotAllowedInCurrentState(loanState, expectedState);
        }
        _;
    }

    function fundLoan() public payable onlyInState(LoanState.Created) {
        token.transfer(
            msg.sender,
            address(this),
            initialLoanAmount,
            true,
            "0x"
        );
        loanState = LoanState.Funded;
    }

    function acceptLoan() public payable onlyInState(LoanState.Funded) {
        borrower = payable(msg.sender);
        token.transfer(address(this), borrower, initialLoanAmount, true, "0x");
        (transactionFee, netMonthlyPayment) = calculateMonthlyPayment();
        currentBalance =
            (transactionFee + netMonthlyPayment) *
            amortizationPeriodInMonths;
        loanState = LoanState.Taken;
    }

    function setPaymentSchedule(uint256[] memory _paymentSchedule) public {
        paymentSchedule = _paymentSchedule;
        paymentIndex = 0;
    }

    function calculateMonthlyPayment()
        public
        view
        returns (
            // internal
            uint256 fee,
            uint256 payment
        )
    {
        uint256 intermediateValue = 1e18 + apy / 1e2;
        uint256 intermediatePower = intermediateValue;
        for (uint256 i = 1; i < 3; i++) {
            intermediatePower = (intermediatePower * intermediateValue) / 1e18;
        }
        uint256 grossMonthlyPayment = (initialLoanAmount * intermediatePower) /
            1e36 /
            amortizationPeriodInMonths;

        uint256 calculatedTransactionFee = (grossMonthlyPayment *
            (transactionPercentage)) / 1e3;
        uint256 calculatedNetMonthlyPayment = grossMonthlyPayment -
            calculatedTransactionFee;

        return (
            calculatedTransactionFee * 1e18,
            calculatedNetMonthlyPayment * 1e18
        );
    }

    function makePayment() public payable onlyInState(LoanState.Taken) {
        if (paymentIndex >= amortizationPeriodInMonths || currentBalance <= 0) {
            revert ZeroBalanceOnLoan();
        }

        if (block.timestamp <= paymentSchedule[paymentIndex]) {
            revert PaymentNotDue(paymentSchedule[paymentIndex]);
        }

        token.transfer(borrower, lender, netMonthlyPayment, true, "0x");
        token.transfer(borrower, nyxCarbonAddress, transactionFee, true, "0x");

        currentBalance -= (netMonthlyPayment + transactionFee);
        paymentIndex += 1;

        if (paymentIndex >= amortizationPeriodInMonths || currentBalance <= 0) {
            loanState = LoanState.Repayed;
        }
    }
}
