# NyxCarbon Lending Protocol

NyxCarbon is on a mission to unlock over a trillion dollars in sustainable finance commitments to help the world adapt to climate change. 

The platform streamlines sustainability linked lending and helps asset managers reduce exposure to climate risk.

NyxCarbon uses AI and digital contracts to improve risk assessments, simplify loan servicing, and create sustainability-linked lending opportunities. 

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
