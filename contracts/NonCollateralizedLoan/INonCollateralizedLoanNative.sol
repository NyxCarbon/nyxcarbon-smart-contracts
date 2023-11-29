// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

/**
 * @title Interface of the Non-Collateralized Loan Contract.
 */
interface INonCollateralizedLoanNative {
    // --- Events
    /**
     * @dev Emitted when the `from` transferred successfully `amount` of tokens to the loan contract and loan state is set to Funded.
     * @param operator The address of the operator that executed the transfer.
     * @param from The address which tokens were sent from (balance decreased by `-amount`).
     * @param to The address that received the tokens (balance increased by `+amount`).
     * @param amount The amount of tokens transferred.
     * @param force if the transferred enforced the `to` recipient address to be a contract that implements the LSP1 standard or not.
     * @param data Any additional data included by the caller during the transfer, and sent in the LSP1 hooks to the `from` and `to` addresses.
     */
    event LoanFunded(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 amount,
        bool force,
        bytes data
    );

    /**
     * @dev Emitted when the loan contract transferred successfully `amount` of tokens to `to` and the loan state is set to Taken.
     * @param operator The address of the operator that executed the transfer.
     * @param from The address which tokens were sent from (balance decreased by `-amount`).
     * @param to The address that received the tokens (balance increased by `+amount`).
     * @param amount The amount of tokens transferred.
     * @param force if the transferred enforced the `to` recipient address to be a contract that implements the LSP1 standard or not.
     * @param data Any additional data included by the caller during the transfer, and sent in the LSP1 hooks to the `from` and `to` addresses.
     */
    event LoanAccepted(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 amount,
        bool force,
        bytes data
    );

    /**
     * @dev Emitted when the `from` transferred successfully `amount` (monthly payment or transaction fee) of tokens to `to` (lender or owner).
     * @param operator The address of the operator that executed the transfer.
     * @param from The address which tokens were sent from (balance decreased by `-amount`).
     * @param to The address that received the tokens (balance increased by `+amount`).
     * @param amount The amount of tokens transferred.
     * @param force if the transferred enforced the `to` recipient address to be a contract that implements the LSP1 standard or not.
     * @param data Any additional data included by the caller during the transfer, and sent in the LSP1 hooks to the `from` and `to` addresses.
     */
    event PaymentMade(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 amount,
        bool force,
        bytes data
    );

    /**
     * @dev Emitted when the borrower has paid the balance of the loan.
     */
    event LoanRepayed();

    /**
     * @dev Emitted when the lender has chosen to liquidate the loan.
     * @param operator The address of the operator that executed the transfer.
     * @param from The address which tokens were sent from (balance decreased by `-amount`).
     * @param to The address that received the tokens (balance increased by `+amount`).
     * @param amount The amount of tokens transferred.
     */
    event LoanLiquidated(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 amount,
        bool force,
        bytes data
    );

    // --- Loan Functionality
    function fundLoan() external payable;

    function acceptLoan() external;

    function makePayment() external payable;

    function liquidiateLoan() external;
}
