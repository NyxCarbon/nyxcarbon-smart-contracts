// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

// --- Errors

/**
 * @dev reverts when sending tokens prior to the due date of a loan
 */
error PaymentNotDue(uint256 dueDate);

/**
 * @dev reverts when sending tokens to a loan with a zero balance
 */
error ZeroBalanceOnLoan();
