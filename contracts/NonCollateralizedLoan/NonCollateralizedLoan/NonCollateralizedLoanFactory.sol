// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import {NonCollateralizedLoan} from "./NonCollateralizedLoan.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NonCollateralizedLoanFactory is Ownable {
    address tokenImplementation;
    address[] public deployedLoans;

    event ContractCreated(address indexed createdContract);

    constructor() {
        tokenImplementation = address(new NonCollateralizedLoan());
    }

    function createLoan(
        uint256 _initialLoanAmount,
        uint256 _apy,
        uint256 _amortizationPeriodInMonths,
        uint256 _lockUpPeriodInMonths,
        uint256 _transactionBps,
        address payable _tokenAddress,
        address payable _lender,
        int256 _carbonCreditsGenerated
    ) public onlyOwner {
        address newLoan = Clones.clone(tokenImplementation);
        NonCollateralizedLoan(newLoan).initialize(
            _initialLoanAmount,
            _apy,
            _amortizationPeriodInMonths,
            _lockUpPeriodInMonths,
            _transactionBps,
            _tokenAddress,
            _lender,
            _carbonCreditsGenerated
        );
        emit ContractCreated(address(newLoan));
        deployedLoans.push(newLoan);
    }

    function getDeployedLoans() public view returns (address[] memory) {
        return deployedLoans;
    }
}
