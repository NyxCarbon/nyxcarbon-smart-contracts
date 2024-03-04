import { ethers } from 'hardhat';

async function main() {
  const tokenId1 = "0x0000000000000000000000000000000000000000000000000000000000000001";
  const _NYX_LOAN_STATUS = "0x4832cf0e94b7269e1cfb3481a8a7cb077570a24dba26f74290b300d0a11ff694";

  console.log('⏳ Evaluating swap state of loan')
  const loan = (await ethers.getContractFactory("NonCollateralizedLoanNativeSimplified", {
    libraries: {
      LoanMath: LOAN_MATH
    },
  })).attach(LOAN);
  
  await loan.evaluateSwapState(tokenId1);
  
  const loanNFT = (await ethers.getContractFactory("NonCollateralizedLoanNFT")).attach(LOAN_NFT);
  const loanState = await loanNFT.getDecodedUint256(tokenId1, _NYX_LOAN_STATUS);
  console.log(
    '✅ Evaluated swap state of loan: ', loanState
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
