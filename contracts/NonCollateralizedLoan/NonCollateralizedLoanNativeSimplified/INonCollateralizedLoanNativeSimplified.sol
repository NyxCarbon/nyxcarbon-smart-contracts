// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

/**
 * @title Interface of the Non-Collateralized Loan Contract.
 */
interface INonCollateralizedLoanNativeSimplified {
    // --- Events
    /**
     * @dev Emitted when a Loan NFT has been created.
     * @param tokenId The tokenId representing the loan that was created.
     */
    event LoanCreated(uint256 indexed tokenId);

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
     * @dev Emitted when the carbon credits can be swapped to clear the remaining balance of the loan.
     * @param carbonCreditBalance The number of carbon credits that would be transferred to the lender if the loan swap is executed.
     * @param expectedProfit The profit that would be realized if the loan swap is executed.
     * @param expectedProfitPercentage The profit percentage that would be realized if the loan swap is executed.
     */
    event LoanSwappable(
        int256 carbonCreditBalance,
        int256 expectedProfit,
        int256 expectedProfitPercentage
    );

    /**
     * @dev Emitted when the carbon credits have been swapped.
     * @param transferredCarbonCredits The number of carbon credits transferred to the lender.
     * @param realizedProfit The lender realized profit.
     * @param realizedProfitPercentage The lender realized profit percentage.
     */
    event LoanSwapped(
        int256 transferredCarbonCredits,
        int256 realizedProfit,
        int256 realizedProfitPercentage
    );

    /**
     * @dev Emitted when the carbon credits cannot be swapped.
     * @param carbonCreditBalance The number of carbon credits that would be transferred to the lender if the loan swap were executable.
     * @param expectedProfit The profit that would be realized if the loan swap were executable.
     * @param expectedProfitPercentage The profit percentage that would be realized if the loan swap were executable.
     */
    event LoanNotSwappable(
        int256 carbonCreditBalance,
        int256 expectedProfit,
        int256 expectedProfitPercentage
    );

    /**
     * @dev Emitted when the profit is no longer greater than 32%.
     * @param expectedProfitPercentage The profit percentage that would be realized if the loan swap were executable.
     */
    event LoanNoLongerSwappable(int256 expectedProfitPercentage);

    struct LoanParams {
        uint256 initialLoanAmount;
        uint256 apy;
        uint256 amortizationPeriodInMonths;
        uint256 lockUpPeriodInMonths;
        uint256 transactionBps;
        address payable lender;
        address payable borrower;
        int256 carbonCreditsGenerated;
    }

    // --- Loan Functionality
    function createLoan(
        LoanParams memory loanParams,
        string memory _cadtProjectName,
        string memory _cadtRegistryLink
    ) external returns (uint256);

    function evaluateSwapState(uint256 tokenId) external;

    function executeSwap(uint256 tokenId) external;

    function makePayment(uint256 tokenId) external payable;
}
