// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

library LoanMath {
    function calculateTotalLoanValue(
        uint256 amount,
        uint256 apy
    ) public pure returns (uint256) {
        uint256 intermediateValue = (((10000 + (apy / 1e16)) ** 3) / 10000);
        return ((amount) * intermediateValue) / 1e8;
    }

    function calculateMonthlyPayment(
        uint256 balance,
        uint256 transactionFee,
        uint256 months
    ) public pure returns (uint256, uint256) {
        uint256 monthlyPayment = (balance) / (months);

        uint256 fee = (monthlyPayment * transactionFee) / 10000;
        uint256 netMonthlyPayment = monthlyPayment - fee;

        return (netMonthlyPayment, fee);
    }

    function calculateProfit(
        uint256 amount,
        int256 units,
        int256 price
    ) public pure returns (int256) {
        // calculate profit as remaining carbon credit balance * current price of carbon credits
        // divided by the initial loan amount
        return (units * price) - int(amount);
    }
}
