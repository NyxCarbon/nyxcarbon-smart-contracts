# NyxCarbon Lending Protocol

This repo contains the smart contracts deployed to the Lukso blockchain for creating a NYXd token (1-1 representation of USD),loan NFT contract (based on LSP7), carbon credit NFT contract (based on LSP8), and several loan contracts.

### Project Setup

1. Run the below command to install the required packages:

   ```
   npm install
   ```

2. Create a .env file based on the .env.template

   ```
   cp .env.template .env
   ```

3. Add the `PRIVATE_KEY` stored in AWS Secrets Manager to the .env file

### To Test

1. Run the below command to compile the smart contracts:
   ```
   npx hardhat compile
   ```
2. Run the below command to test the smart contracts:
   ```
   npx hardhat test
   ```
3. Run the below command to execute the deployment scripts:
   ```
   npx hardhat --network luksoTestnet run scripts/EOA/inspectLoanNFT.ts
   ```

### To Deploy

1. Run the below command with the correct network:

   ```
   npx hardhat --network luksoTestnet run scripts/EOA/deploy.js
   ```
