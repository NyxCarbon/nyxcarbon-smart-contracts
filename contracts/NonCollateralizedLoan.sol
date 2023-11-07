// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import {LSP7Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/presets/LSP7Mintable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract NonCollateralizedLoan {
    using SafeMath for uint256;

    LSP7Mintable public token;

    enum LoanState {
        Created,
        Funded,
        Taken,
        Repayed,
        Liquidated
    }
    LoanState public loanState;

    address payable public lender;
    address payable public borrower;
    address payable public nyxCarbonAddress;

    uint256 public amount;
    uint256 public apy;
    uint256 public amortizationPeriodInMonths;
    uint256 public lockUpPeriodInMonths;
    uint256 public transactionPercentage;

    address payable public tokenAddress;

    uint256 public transactionFee;
    uint256 public netMonthlyPayment;
    uint256 public dueDate;

    constructor(
        uint256 _amount,
        uint256 _apy,
        uint256 _amortizationPeriodInMonths,
        uint256 _lockUpPeriodInMonths,
        uint256 _transactionPercentage,
        address payable _tokenAddress,
        address payable _nyxCarbonAddress
    ) {
        amount = _amount * 1e18;
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
        require(loanState == expectedState, "Not allowed in this loanState");
        _;
    }

    // Is this really necessary?!
    modifier checkAuthorizedAmount() {
        require(
            token.authorizedAmountFor(address(this), msg.sender) >= amount,
            "Contract is now authorized to send this amount of tokens"
        );
        _;
    }

    function fundLoan()
        public
        payable
        onlyInState(LoanState.Created)
        checkAuthorizedAmount
    {
        token.transfer(msg.sender, address(this), amount, true, "0x");
        loanState = LoanState.Funded;
    }

    function acceptLoan() public payable onlyInState(LoanState.Funded) {
        borrower = payable(msg.sender);
        token.transfer(address(this), borrower, amount, true, "0x");
        loanState = LoanState.Taken;
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
        uint256 grossMonthlyPayment = (amount * intermediatePower) / 1e36 / 36;

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
        (transactionFee, netMonthlyPayment) = calculateMonthlyPayment();

        require(block.timestamp <= dueDate, "Payment is not due yet");
        require(
            netMonthlyPayment <= amount,
            "There is no balance remaining on this loan"
        );
        require(
            msg.value >= netMonthlyPayment + transactionFee,
            "The message value does not cover the monthly payment and transaction fee"
        );

        amount -= netMonthlyPayment;
        dueDate += (86400 * 30);
        token.transfer(borrower, lender, netMonthlyPayment, true, "0x");
        token.transfer(borrower, nyxCarbonAddress, transactionFee, true, "0x");
    }
}
