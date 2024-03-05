import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
const fs = require("fs");

dotenv.config();
const { PRIVATE_KEY } = process.env;

async function main() {
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];

  console.log('⏳ Deploying the LoanMath library')
  const LoanMathLibContractFactory = await ethers.getContractFactory("LoanMath");
  const loanMathLib = await LoanMathLibContractFactory.deploy();
  await loanMathLib.waitForDeployment();
  console.log(
    '✅ Custom LoanMath library successfully deployed at address: ',
    await loanMathLib.getAddress(),
  );

  console.log('⏳ Deploying the LoanNFT contract')
  const LoanNFTContractFactory = await ethers.getContractFactory("NonCollateralizedLoanNFT");
  const loanNFT = await LoanNFTContractFactory.deploy("NYXLoanNativeNFT", "NYXLN", deployer);
  await loanNFT.waitForDeployment();
  console.log(
    '✅ Custom LoanNFT contract successfully deployed at address: ',
    await loanNFT.getAddress(),
  );

  console.log('⏳ Deploying the CarbonCreditNFTCollection contract')
  const CarbonCreditNFTContractFactory = await ethers.getContractFactory("CarbonCreditNFTCollection");
  const carbonCreditNFT = await CarbonCreditNFTContractFactory.deploy("NyxCarbonCreditCollection", "NCCC", deployer);
  await carbonCreditNFT.waitForDeployment();
  console.log(
    '✅ Custom CarbonCreditNFTCollection contract successfully deployed at address: ',
    await carbonCreditNFT.getAddress(),
  );

  console.log('⏳ Deploying the Loan contract')
  const LoanContractFactory = await ethers.getContractFactory("NonCollateralizedLoanNativeSimplified", {
    libraries: {
      LoanMath: (await loanMathLib.getAddress())
    },
  });
  const loan = await LoanContractFactory.deploy(await loanNFT.getAddress(), await carbonCreditNFT.getAddress());
  await loan.waitForDeployment();
  console.log(
    '✅ Custom Loan contract successfully deployed at address: ',
    await loan.getAddress(),
  );

  console.log('⏳ Transferring ownership of LoanNFT to Loan contract')
  const abiPath = "./artifacts/contracts/NonCollateralizedLoan/NonCollateralizedLoanNFT/NonCollaterlizedLoanNFT.sol/NonCollateralizedLoanNFT.json";
  const abi = JSON.parse(fs.readFileSync(abiPath).toString()).abi;

  const provider = new ethers.JsonRpcProvider(
      'https://rpc.testnet.lukso.network',
  );

  const EOA = new ethers.Wallet(PRIVATE_KEY as string, provider);
  const LoanNFT = new ethers.Contract(await loanNFT.getAddress(), abi);

  await LoanNFT.connect(EOA).transferOwnership(await loan.getAddress());
  console.log(
    '✅ Ownership of LoanNFT successfully transferred to Loan contract'
  );

  console.log('⏳ Transferring ownership of CarbonCreditNFTCollection to Loan contract')
  const ccAbiPath = "./artifacts/contracts/CarbonCreditNFTCollection/CarbonCreditNFTCollection.sol/CarbonCreditNFTCollection.json";
  const ccAbi = JSON.parse(fs.readFileSync(ccAbiPath).toString()).abi;

  const CarbonCreditNFT = new ethers.Contract(await carbonCreditNFT.getAddress(), abi);

  await CarbonCreditNFT.connect(EOA).transferOwnership(await loan.getAddress());
  console.log(
    '✅ Ownership of CarbonCreditNFTCollection successfully transferred to Loan contract'
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
