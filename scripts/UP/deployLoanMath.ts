import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

import UniversalProfileArtifact from '@lukso/lsp-smart-contracts/artifacts/LSP0ERC725Account.json';
import { LoanMath__factory } from '../../typechain-types';

// load env vars
dotenv.config();
const { UP_ADDR } = process.env;

async function main() {
  // load the associated UP
  const universalProfile = await ethers.getContractAtFromArtifact(
    UniversalProfileArtifact,
    UP_ADDR as string,
  );

  // Get the bytecode for the LoanMath lib
  console.log('⏳ Deploying the LoanMath library')
  const customLoanMathBytecode = LoanMath__factory.bytecode;

  // Get the address of the LoanMath lib that will be created
  const CustomLoanMathAddress = await universalProfile.execute(
    3, // Operation type: STATICCALL
    ethers.ZeroAddress,
    0, // Value is empty
    customLoanMathBytecode,
  );
    
  // Deploy LoanMath contract
  const tx = await universalProfile.execute(
    1, // Operation type: CREATE
    ethers.ZeroAddress,
    0, // Value is empty
    customLoanMathBytecode,
  );

  // wait for the tx to be mined
  await tx.wait();

  console.log(
    '✅ Custom LoanMath library successfully deployed at address: ',
    CustomLoanMathAddress,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
