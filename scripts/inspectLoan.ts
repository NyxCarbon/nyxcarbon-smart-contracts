import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
const fs = require("fs");

dotenv.config();
const { PRIVATE_KEY } = process.env;

async function main() {
    const abiPath = "./artifacts/contracts/NonCollateralizedLoan/NonCollateralizedLoan.sol/NonCollateralizedLoan.json";
    const abi = JSON.parse(fs.readFileSync(abiPath).toString()).abi;

    const provider = new ethers.JsonRpcProvider(
        'https://rpc.testnet.lukso.network',
    );

    const myEOA = new ethers.Wallet(PRIVATE_KEY as string, provider);
    const myLoan = new ethers.Contract("0x42137d3c75748D5065B0A52d52cee85616682382", abi);
    
    try {
      let lender = await myLoan.connect(myEOA).lender();
      console.log(`Lender: ${lender}`)
      let loanAmount = await myLoan.connect(myEOA).initialLoanAmount();
      console.log(`Loan Amount: ${loanAmount}`)
      let loanState = await myLoan.connect(myEOA).loanState();
      console.log(`Loan State: ${loanState}`)
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