import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

import UniversalProfileArtifact from '@lukso/lsp-smart-contracts/artifacts/LSP0ERC725Account.json';
import { NonCollateralizedLoanNative__factory } from '../../typechain-types';

// load env vars
dotenv.config();
const { UP_ADDR } = process.env;

async function main() {
  // load the associated UP
  const universalProfile = await ethers.getContractAtFromArtifact(
    UniversalProfileArtifact,
    UP_ADDR as string,
  );

  // Get the bytecode for the Loan contract
  console.log('⏳ Deploying the Loan contract')
  const customLoanBytecode = NonCollateralizedLoanNative__factory.bytecode;

  // Constructor parameters
  const nftContractAddress = '0x1F19c23bC8AF31B7B612E61425cC955b665C432F';

  // Encode constructor params
  const abiEncoder = new ethers.AbiCoder();
  const encodedConstructorParams = abiEncoder.encode(
    ['address'],
    [
      nftContractAddress,
    ],
  );

  // Add the constructor params to the Custom Token bytecode
  const CustomLoanBytecodeWithConstructor =
    customLoanBytecode + encodedConstructorParams.slice(2);

  // Get the address of the Loan contract that will be created
  const CustomLoanAddress = await universalProfile.execute(
    3, // Operation type: STATICCALL
    ethers.ZeroAddress,
    0, // Value is empty
    CustomLoanBytecodeWithConstructor,
  );
    
  // Deploy Loan contract
  const tx = await universalProfile.execute(
    1, // Operation type: CREATE
    ethers.ZeroAddress,
    0, // Value is empty
    CustomLoanBytecodeWithConstructor,
  );

  // wait for the tx to be mined
  await tx.wait();

  console.log(
    '✅ Custom Loan contract successfully deployed at address: ',
    CustomLoanAddress,
  );


  // // Deploy Loan #1
  // let initialLoanAmount = 500000;
  // const apy = 14;
  // const amortizationPeriodInMonths = 36;
  // const lockUpPeriodInMonths = 18;
  // const transactionBPS = 80;

  // const tx1 = await loanFactory.createLoan(
  //   initialLoanAmount,
  //   apy,
  //   amortizationPeriodInMonths,
  //   lockUpPeriodInMonths,
  //   transactionBPS,
  //   UP_ADDR
  // );
  // await tx1.wait();

  // let deployedLoans = await loanFactory.getDeployedLoans();
  // console.log(`Loan #1 Address: ${deployedLoans[0]}`);

  // let loan = await ethers.getContractAt("NonCollateralizedLoanNative", deployedLoans[0]);
  // console.log(`Loan #1 Lender: ${await loan.lender()}`);
  // console.log(`Loan #1 Initial Loan Amount: ${ethers.formatEther((await loan.initialLoanAmount()).toString())}`);

  // // Deploy Loan #2
  // initialLoanAmount = 10000;

  // const tx2 = await loanFactory.createLoan(
  //   initialLoanAmount,
  //   apy,
  //   amortizationPeriodInMonths,
  //   lockUpPeriodInMonths,
  //   transactionBPS,
  //   UP_ADDR
  // );
  // await tx2.wait();

  // deployedLoans = await loanFactory.getDeployedLoans();
  // console.log(`Loan #2 Address: ${deployedLoans[1]}`);

  // loan = await ethers.getContractAt("NonCollateralizedLoanNative", deployedLoans[1]);
  // console.log(`Loan #2 Lender: ${await loan.lender()}`);
  // console.log(`Loan #2 Initial Loan Amount: ${ethers.formatEther((await loan.initialLoanAmount()).toString())}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
