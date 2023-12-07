import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

// load env vars
dotenv.config();
const { UP_ADDR } = process.env;

async function main() {
  // Hardhat has some issues with EIP 1559 settings, so we force it
  // See this issue for more info: https://github.com/NomicFoundation/hardhat/issues/3418
  const { maxFeePerGas, maxPriorityFeePerGas } =
    await ethers.provider.getFeeData();

  // Deploy Loan Factory 
  const loanFactoryContractFactory = await ethers.getContractFactory("NonCollateralizedLoanNativeFactory");
  const loanFactoryContract = await loanFactoryContractFactory.deploy({
    maxFeePerGas,
    maxPriorityFeePerGas,
    type: 2,
  });
  const loanFactory = await loanFactoryContract.waitForDeployment();
  console.log(`Loan Factory Address: ${await loanFactory.getAddress()}`);

  // Deploy Loan #1
  let initialLoanAmount = 500000;
  const apy = 14;
  const amortizationPeriodInMonths = 36;
  const lockUpPeriodInMonths = 18;
  const transactionBPS = 80;

  const tx1 = await loanFactory.createLoan(
    initialLoanAmount,
    apy,
    amortizationPeriodInMonths,
    lockUpPeriodInMonths,
    transactionBPS,
    UP_ADDR
  );
  await tx1.wait();

  let deployedLoans = await loanFactory.getDeployedLoans();
  console.log(`Loan #1 Address: ${deployedLoans[0]}`);

  let loan = await ethers.getContractAt("NonCollateralizedLoanNative", deployedLoans[0]);
  console.log(`Loan #1 Lender: ${await loan.lender()}`);
  console.log(`Loan #1 Initial Loan Amount: ${ethers.formatEther((await loan.initialLoanAmount()).toString())}`);

  // Deploy Loan #2
  initialLoanAmount = 10000;

  const tx2 = await loanFactory.createLoan(
    initialLoanAmount,
    apy,
    amortizationPeriodInMonths,
    lockUpPeriodInMonths,
    transactionBPS,
    UP_ADDR
  );
  await tx2.wait();

  deployedLoans = await loanFactory.getDeployedLoans();
  console.log(`Loan #2 Address: ${deployedLoans[1]}`);

  loan = await ethers.getContractAt("NonCollateralizedLoanNative", deployedLoans[1]);
  console.log(`Loan #2 Lender: ${await loan.lender()}`);
  console.log(`Loan #2 Initial Loan Amount: ${ethers.formatEther((await loan.initialLoanAmount()).toString())}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
