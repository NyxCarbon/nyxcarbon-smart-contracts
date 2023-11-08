// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

// --- Enums

/**
 * @dev the possible states of a loan
 */
enum LoanState {
    Created,
    Funded,
    Taken,
    Repayed,
    Liquidated
}
