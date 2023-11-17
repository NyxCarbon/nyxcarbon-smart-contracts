# NyxCarbon Lending Protocol

This repo contains the smart contracts deployed to the Lukso blockchain for creating a NYXd token, which is a 1-1 representation of USD, and a loan contract. The token is minted when a USDC token is sent to a NyxCarbon address and returned to the sender's address. The token can be used by a user to lend capital to a project developer to fund their sustainability project and receive a 14% APY or carbon credits. The second contract contains the actually loan contract.

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
4. Add your UP Address to the .env file

### To test

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
   npx hardhat --network luksoTestnet run scripts/inspectLoan.ts
   ```
