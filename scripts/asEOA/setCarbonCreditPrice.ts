import { ethers } from 'hardhat';
import { LUKSO_LOAN_MATH, LUKSO_LOAN } from './constants';

async function main() {
  console.log('⏳ Setting the carbon credit price globally')
  const loan = (await ethers.getContractFactory("NonCollateralizedLoanNativeSimplified", {
    libraries: {
      LoanMath: LUKSO_LOAN_MATH
    },
  })).attach(LUKSO_LOAN);
  
  await loan.setCarbonCreditPrice(ethers.parseEther('1.36'));
  
  const carbonCreditPrice = await loan.carbonCreditPrice();  
  console.log(
    '✅ Carbon credit price set globally: ', carbonCreditPrice
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
