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
  const NFTContractFactory = await ethers.getContractFactory("NonCollateralizedLoanNFT");
  const NFT = await NFTContractFactory.deploy("NYXLoanNativeNFT", "NYXLN", deployer);
  await NFT.waitForDeployment();
  console.log(
    '✅ Custom LoanNFT contract successfully deployed at address: ',
    await NFT.getAddress(),
  );

  console.log('⏳ Deploying the Loan contract')
  const LoanContractFactory = await ethers.getContractFactory("NonCollateralizedLoanNative", {
    libraries: {
      LoanMath: (await loanMathLib.getAddress())
    },
  });
  const Loan = await LoanContractFactory.deploy(await NFT.getAddress());
  await Loan.waitForDeployment();
  console.log(
    '✅ Custom Loan contract successfully deployed at address: ',
    await Loan.getAddress(),
  );

  console.log('⏳ Transferring ownership of LoanNFT to Loan contract')
  const abiPath = "./artifacts/contracts/CarbonCreditNFTCollection/CarbonCreditNFTCollection.sol/CarbonCreditNFTCollection.json";
  const abi = JSON.parse(fs.readFileSync(abiPath).toString()).abi;

  const provider = new ethers.JsonRpcProvider(
      'https://rpc.testnet.lukso.network',
  );

  const EOA = new ethers.Wallet(PRIVATE_KEY as string, provider);
  const LoanNFT = new ethers.Contract(await NFT.getAddress(), abi);

  await LoanNFT.connect(EOA).transferOwnership(await Loan.getAddress());
  console.log(
    '✅ Ownership of LoanNFT successfully transferred to Loan contract'
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
