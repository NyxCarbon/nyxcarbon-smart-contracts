import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
const fs = require("fs");

dotenv.config();
const { PRIVATE_KEY } = process.env;

async function main() {
    const abiPath = "./artifacts/contracts/NonCollateralizedLoan/NonCollateralizedLoanNative/NonCollateralizedLoanNative.sol/NonCollateralizedLoanNative.json";
    const abi = JSON.parse(fs.readFileSync(abiPath).toString()).abi;

    const provider = new ethers.JsonRpcProvider(
        'https://rpc.testnet.lukso.network',
    );

    const EOA = new ethers.Wallet(PRIVATE_KEY as string, provider);
    const Loan = new ethers.Contract("0x6165c6c67365e5c1C39419397da0AfB0EeBb7FC1", abi);
    
    try {
      const initialLoanAmount: bigint = BigInt(1000);
      const apy: bigint = BigInt(14);
      const amortizationPeriodInMonths: bigint = BigInt(36);
      const lockUpPeriodInMonths: bigint = BigInt(18);
      const transactionBPS: bigint = BigInt(80);
      const carbonCreditsGenerated: bigint = BigInt(25);
      const carbonCreditPrice: bigint = BigInt(40);

      const tx1 = await Loan.connect(EOA).createLoan(
        initialLoanAmount,
        apy,
        amortizationPeriodInMonths,
        lockUpPeriodInMonths,
        transactionBPS,
        EOA,
        carbonCreditsGenerated,
        carbonCreditPrice
      );

      const tokenId = await tx1.wait();

      console.log(`Token ID: ${tokenId}`);
    } catch (error) {
      console.error(error);
    }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });