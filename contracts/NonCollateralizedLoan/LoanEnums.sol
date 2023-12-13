// SPDX-License-Identifier: Apache-2.0
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
    Liquidated,
    Swappable,
    Swapped
}
