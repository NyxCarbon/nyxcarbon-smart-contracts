import { ethers } from 'hardhat';

async function main() {
  console.log('⏳ Deploying the Loan library')

  const LoanContractFactory = await ethers.getContractFactory("NonCollateralizedLoanNative", {
    libraries: {
      LoanMath: '0xb081CD9c545683D7fd54fF06bfc64DFC3aDD1A60'
    },
  });
    const Loan = await LoanContractFactory.deploy('0xAFD7a4762629C3389C9f1964E3282f8706294dCa')
    await Loan.waitForDeployment();

  console.log(
    '✅ Custom Loan successfully deployed at address: ',
    await Loan.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
