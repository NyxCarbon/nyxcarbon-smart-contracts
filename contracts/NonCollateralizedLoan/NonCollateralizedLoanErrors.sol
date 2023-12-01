// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import {LoanState} from "./LoanEnums.sol";

// --- Errors

/**
 * @dev reverts when sending tokens prior to the due date of a loan
 */
error PaymentNotDue(uint256 dueDate);

/**
 * @dev reverts when sending tokens to a loan with a zero balance
 */
error ZeroBalanceOnLoan();

/**
 * @dev reverts when loan is not in the correct state
 */
error ActionNotAllowedInCurrentState(
    LoanState currentState,
    LoanState expectedState
);

/**
 * @dev reverts when msg.sender is not authorized to perform action
 */
error Unauthorized(address caller);
