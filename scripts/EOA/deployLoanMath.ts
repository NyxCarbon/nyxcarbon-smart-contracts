import { ethers } from 'hardhat';

async function main() {
  console.log('⏳ Deploying the LoanMath library')

  const LoanMathLibContractFactory = await ethers.getContractFactory("LoanMath");
  const loanMathLib = await LoanMathLibContractFactory.deploy();
  await loanMathLib.waitForDeployment();

  console.log(
    '✅ Custom LoanMath library successfully deployed at address: ',
    await loanMathLib.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
