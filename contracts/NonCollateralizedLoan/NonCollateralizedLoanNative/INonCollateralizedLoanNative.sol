// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

/**
 * @title Interface of the Non-Collateralized Loan Contract.
 */
interface INonCollateralizedLoanNative {
    // --- Events
    /**
     * @dev Emitted when a Loan NFT has been created.
     * @param tokenId The tokenId representing the loan that was created.
     */
    event LoanCreated(uint256 indexed tokenId);

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

    /**
     * @dev Emitted when a new CAD Trust Project has been added to the loan metadata.
     * @param name The project name.
     * @param registryLink The link to the registry where the project data is tracked.
     * @param units The units of carbon generated by this project.
     * @param geographicIdentifier The geographic identifier associated with this project.
     * @param arrayIndex The array index where the project is stored.
     */
    event ProjectAdded(
        string name,
        string registryLink,
        uint256 units,
        string geographicIdentifier,
        uint128 arrayIndex
    );

    /**
     * @dev Emitted when units of carbon for a project has been updated.
     * @param tokenId The tokenId for the loan.
     * @param arrayIndex The array index where the project is stored.
     * @param dataKey The data key for the element that has been updated.
     * @param dataValue The value for the element that has been updated.
     */
    event ProjectElementUpdated(
        uint256 tokenId,
        uint128 arrayIndex,
        bytes32 dataKey,
        bytes dataValue
    );

    struct LoanParams {
        uint256 initialLoanAmount;
        uint256 apy;
        uint256 amortizationPeriodInMonths;
        uint256 gracePeriodInMonths;
        uint256 transactionBps;
        address payable lender;
        address payable borrower;
        uint256 carbonCreditsStaked;
    }

    // --- Loan Functionality
    function createLoan(
        LoanParams memory loanParams
    ) external returns (uint256);

    function fundLoan(uint256 tokenId) external payable;

    function acceptLoan(uint256 tokenId) external;

    function addCADTProject(
        uint256 tokenId,
        string memory _projectName,
        string memory _registryLink,
        uint256 _units,
        string memory geographicIdentifier
    ) external;

    function getCADTProject(
        uint256 tokenId,
        uint128 arrayIndex
    ) external view returns (bytes[] memory dataValues);

    function updateCADTProjectElement(
        uint256 tokenId,
        uint128 arrayIndex,
        bytes32 dataKey,
        bytes memory dataValue
    ) external;

    function evaluateSwapState(uint256 tokenId) external;

    function executeSwap(uint256 tokenId) external;

    function makePayment(uint256 tokenId) external payable;

    function liquidiateLoan(uint256 tokenId) external;
}
