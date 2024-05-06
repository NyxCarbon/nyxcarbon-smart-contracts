import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

import LSP0Artifact from '@lukso/lsp-smart-contracts/artifacts/LSP0ERC725Account.json';

dotenv.config();
const { UP_ADDR } = process.env;

async function main() {
  // UP controller used for deployment
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with Universal Profile controller: ', deployer.address);

  // Load the Universal Profile
  const universalProfile = await ethers.getContractAtFromArtifact(
    LSP0Artifact,
    UP_ADDR as string,
  );

  // Create custom bytecode for the loan math contract deployment
  const loanMathBytecode = (await ethers.getContractFactory('LoanMath')).bytecode;

  // Get the address of the loan math contract that will be created
  // https://docs.lukso.tech/contracts/contracts/ERC725/#execute
  const loanMathAddress = await universalProfile.execute.staticCall(
    1,
    ethers.ZeroAddress,
    0,
    loanMathBytecode,
  );

  // Deploy the contract by the Universal Profile
  // https://docs.lukso.tech/contracts/contracts/ERC725/#execute
  const tx = await universalProfile.execute(
    1,
    ethers.ZeroAddress,
    0,
    loanMathBytecode,
  );

  // Wait for the transaction to be included in a block
  await tx.wait();
  console.log('✅ LoanMath library deployed at: ', loanMathAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
