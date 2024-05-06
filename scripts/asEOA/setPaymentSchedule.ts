import { ethers } from 'hardhat';
import { subtractMonths, generateEpochTimestamps } from '../../test/utils';
import { LOAN_MATH, LOAN } from './constants';

async function main() {
  const tokenId1 = "0x0000000000000000000000000000000000000000000000000000000000000001";

  console.log('⏳ Setting the payment schedule')
  const loan = (await ethers.getContractFactory("NonCollateralizedLoanNativeSimplified", {
    libraries: {
      LoanMath: LOAN_MATH
    },
  })).attach(LOAN);
  
  await loan.setPaymentSchedule(tokenId1, generateEpochTimestamps(subtractMonths(18)));
  
  const paymentSchedule = await loan.getPaymentSchedule(tokenId1);
  console.log(
    '✅ Payment schedule set: ', paymentSchedule
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
