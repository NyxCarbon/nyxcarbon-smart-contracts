import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

import UniversalProfileArtifact from '@lukso/lsp-smart-contracts/artifacts/LSP0ERC725Account.json';
import { NonCollateralizedLoanNFT__factory } from '../../typechain-types';

// load env vars
dotenv.config();
const { UP_ADDR } = process.env;

async function main() {
  // load the associated UP
  const universalProfile = await ethers.getContractAtFromArtifact(
    UniversalProfileArtifact,
    UP_ADDR as string,
  );

  // Get the bytecode for the LoanNFT
  console.log('⏳ Deploying the LoanNFT contract')
  const customLoanNFTBytecode = NonCollateralizedLoanNFT__factory.bytecode;

  // Constructor parameters
  const name = 'NYXLoanNativeNFT';
  const token = 'NYXLN';
  const owner = (await ethers.getSigners())[0].address;;

  // Encode constructor params
  const abiEncoder = new ethers.AbiCoder();
  const encodedConstructorParams = abiEncoder.encode(
    ['string', 'string', 'address'],
    [
      name,
      token,
      owner
    ],
  );

  // Add the constructor params to the Custom Token bytecode
  const CustomLoanBytecodeWithConstructor =
    customLoanNFTBytecode + encodedConstructorParams.slice(2);

  // Get the address of the LoanNFT that will be created
  const CustomLoanNFTAddress = await universalProfile.execute(
    3, // Operation type: STATICCALL
    ethers.ZeroAddress,
    0, // Value is empty
    CustomLoanBytecodeWithConstructor,
  );
    
  // Deploy LoanNFT contract
  const tx = await universalProfile.execute(
    1, // Operation type: CREATE
    ethers.ZeroAddress,
    0, // Value is empty
    CustomLoanBytecodeWithConstructor,
  );

  // wait for the tx to be mined
  await tx.wait();

  console.log(
    '✅ Custom LoanNFT library successfully deployed at address: ',
    CustomLoanNFTAddress,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
