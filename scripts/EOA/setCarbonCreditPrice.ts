import { ethers } from 'hardhat';
import { LOAN_MATH, LOAN } from './constants';

async function main() {
  console.log('⏳ Setting the carbon credit price globally')
  const loan = (await ethers.getContractFactory("NonCollateralizedLoanNativeSimplified", {
    libraries: {
      LoanMath: LOAN_MATH
    },
  })).attach(LOAN);
  
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
