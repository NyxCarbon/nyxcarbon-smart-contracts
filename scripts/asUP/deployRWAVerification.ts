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

  const bytecode = (await ethers.getContractFactory('RWAVerification')).bytecode;

  const name = 'RWAVerification';
  const token = 'RWAV';
  const owner = UP_ADDR;

  const abiEncoder = new ethers.AbiCoder();
  const encodedConstructorParams = abiEncoder.encode(
    ['string', 'string', 'address', 'address'],
    [
      name,
      token,
      owner,
      owner
    ],
  );

  const bytecodeWithConstructor = ethers.concat([bytecode, encodedConstructorParams])

  const rwaVerificationAddress = await universalProfile.execute.staticCall(
    1,
    ethers.ZeroAddress,
    0,
    bytecodeWithConstructor,
  );

  const tx = await universalProfile.execute(
    1,
    ethers.ZeroAddress,
    0,
    bytecodeWithConstructor,
  );

  await tx.wait();

  console.log('✅ rwaVerification contract deployed at: ', rwaVerificationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
