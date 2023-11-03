// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import { LSP7Mintable } from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/presets/LSP7Mintable.sol";

contract NonCollateralizedLoan {
    LSP7Mintable public token;

    struct LoanTerms {
        uint256 amount;
        uint256 apy;
        uint256 amortizationPeriodInMonths;
        uint256 lockUpPeriodInMonths;
        uint256 transactionPercentage;
    }
    LoanTerms public loanTerms;

    enum LoanState {Created, Funded, Taken, Repayed, Liquidated}
    LoanState public loanState;

    address payable public lender;
    address payable public borrower;
    address payable public nyxCarbonAddress;
    address payable public tokenAddress;
    
    uint256 public remainingBalance;
    uint256 public transactionFee;
    uint256 public netMonthlyPayment;
    uint256 public dueDate;

    constructor(LoanTerms memory _terms, address payable _tokenAddress, address payable _nyxCarbonAddress) {
        loanTerms = _terms;
        tokenAddress = _tokenAddress;
        nyxCarbonAddress = _nyxCarbonAddress;
        remainingBalance = _terms.amount;
        lender = payable(msg.sender);
        loanState = LoanState.Created;
    }

    modifier onlyInState(LoanState expectedState) {
        require(loanState == expectedState, "Not allowed in this loanState");
        _;
    }

    function fundLoan() public onlyInState(LoanState.Created) {
        loanState = LoanState.Funded;
        // Need to check if we can send to address without LSP1 Universal Receiver
        LSP7Mintable(tokenAddress).transfer(msg.sender, address(this), loanTerms.amount, true, '0x');
    }

    function calculateMonthlyPayment() internal view returns (uint256 fee, uint256 payment) {
        uint256 grossMonthlyPayment = loanTerms.amount * ((1 + ((loanTerms.apy / 100) / 1)) ** 3);
        uint256 calculatedTransactionFee = grossMonthlyPayment * loanTerms.transactionPercentage;
        uint256 calculatedNetMonthlyPayment = grossMonthlyPayment - calculatedTransactionFee;

        return (calculatedTransactionFee, calculatedNetMonthlyPayment);
    }

    function takeLoanAndAcceptLoanTerms() public payable onlyInState(LoanState.Funded) {
        borrower = payable(msg.sender);
        dueDate = block.timestamp + (86400 * 30 * loanTerms.lockUpPeriodInMonths);
        loanState = LoanState.Taken;
        // Need to check if we can send to address without LSP1 Universal Receiver
        LSP7Mintable(tokenAddress).transfer(address(this), borrower, loanTerms.amount, true, '0x');
    }

    function makePayment() public payable onlyInState(LoanState.Taken) {
        (transactionFee, netMonthlyPayment) = calculateMonthlyPayment();

        require(block.timestamp <= dueDate, "Payment is not due yet");
        require(netMonthlyPayment <= remainingBalance, "There is no balance remaining on this loan");
        require(msg.value >= netMonthlyPayment, "The message value does not cover the monthly payment");

        remainingBalance -= netMonthlyPayment;
        dueDate += (86400 * 30);
        LSP7Mintable(tokenAddress).transfer(borrower, lender, netMonthlyPayment, true, '0x');
        LSP7Mintable(tokenAddress).transfer(borrower, nyxCarbonAddress, transactionFee, true, '0x');
    }
}