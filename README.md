# NyxCarbon Lending Protocol

This repo contains the below smart contracts used by NyxCarbon to manage the loan transaction workflow. These contracts have been deployed to the Lukso Testnet and Peaq Mainnet.

1. `RWAVerification`: Extension of LSP8 used to create a token for real world asset verification.
2. `LoanTxData`: Extension of LSP8 used to create a token for tracking off-chain loan data (e.g., balance, APY, lender address)
3. `LoanContract`: Smart contract used to record loan transaction steps for LSP7/ERC20 tokens (e.g., make payment, swap remaining balance for carbon credits)
4. `LYXLoanContract`: Smart contract used to facilitate loan transaction steps for LYX tokens (e.g., fund loan, make payment, swap remaining balance for carbon credits)
5. `LYXLoanContractSimple`: Smart contract used to record loan transaction steps for LYX tokens where actions take place through other contracts (e.g., make payment, swap remaining balance for carbon credits)

### Project Setup

1. Run the below command to install the required packages:

   ```
   npm install
   ```

2. Create a .env file based on the .env.template

   ```
   cp .env.template .env
   ```

3. Add the controller `PRIVATE_KEY` which will be used for deployment, `UP_ADDR` which will be the owner of the contracts, and the `RPC_URL`.

### To Test

1. Run the below command to compile the smart contracts:
   ```
   npx hardhat compile
   ```
2. Run the below command to test the smart contracts:
   ```
   npx hardhat test
   ```

### To Deploy

1. Run the below command to execute the deployment script for the Loan Math library to the Lukso Testnet:

   ```
   npx hardhat --network luksoTestnet run scripts/asUP/deployLoanMath.ts
   ```
