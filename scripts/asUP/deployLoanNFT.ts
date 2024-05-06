import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

import LSP0Artifact from '@lukso/lsp-smart-contracts/artifacts/LSP0ERC725Account.json';

dotenv.config();
const { UP_ADDR } = process.env;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with Universal Profile controller: ', deployer.address);

  const universalProfile = await ethers.getContractAtFromArtifact(
    LSP0Artifact,
    UP_ADDR as string,
  );

  console.log('⏳ Deploying the LoanNFT contract')
  const loanNFTBytecode = (await ethers.getContractFactory('NonCollateralizedLoanNFT')).bytecode;

  const name = 'NYXLoanNativeNFT';
  const token = 'NYXLN';
  const owner = UP_ADDR;

  const abiEncoder = new ethers.AbiCoder();
  const encodedConstructorParams = abiEncoder.encode(
    ['string', 'string', 'address'],
    [
      name,
      token,
      owner
    ],
  );

  const loanNFTBytecodeWithConstructor = ethers.concat([loanNFTBytecode, encodedConstructorParams]);

  const loanNFTAddress = await universalProfile.execute.staticCall(
    1,
    ethers.ZeroAddress,
    0,
    loanNFTBytecodeWithConstructor,
  );

  const tx = await universalProfile.execute(
    1,
    ethers.ZeroAddress,
    0,
    loanNFTBytecodeWithConstructor,
  );

  await tx.wait();

  console.log(
    '✅ LoanNFT contract successfully deployed at address: ',
    loanNFTAddress,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
