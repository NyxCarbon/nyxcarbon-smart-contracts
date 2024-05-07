import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

import LSP0Artifact from '@lukso/lsp-smart-contracts/artifacts/LSP0ERC725Account.json';
import { LUKSO_LOAN_MATH, LUKSO_LOAN_TX_DATA, LUKSO_RWA_VERIFICATION } from '../asUP/constants';

dotenv.config();
const { UP_ADDR } = process.env;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with Universal Profile controller: ', deployer.address);

  const universalProfile = await ethers.getContractAtFromArtifact(
    LSP0Artifact,
    UP_ADDR as string,
  );

  // Deploying the Loan contract
  console.log('⏳ Deploying the Loan contract')
  const bytecode = (await ethers.getContractFactory('LYXLoanContractSimple', {
    libraries: {
      LoanMath: (LUKSO_LOAN_MATH)
    },
  })).bytecode;

  const abiEncoder = new ethers.AbiCoder();
  const encodedConstructorParams = abiEncoder.encode(
    ['address', 'address'],
    [
      LUKSO_LOAN_TX_DATA,
      LUKSO_RWA_VERIFICATION
    ],
  );

  const bytecodeWithConstructor = ethers.concat([bytecode, encodedConstructorParams])

  const loanAddress = await universalProfile.execute.staticCall(
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
  
  console.log(
    '✅ LYXLoanContractSimple successfully deployed at address: ',
    loanAddress,
  );

  // Transferring ownership of LoanTxData to Loan contract
  console.log('⏳ Transferring ownership of LoanTxData to Loan contract')
  const abiPath = "./artifacts/contracts/LoanContract/LoanTxData/LoanTxData.sol/LoanTxData.json";
  const abi = JSON.parse(fs.readFileSync(abiPath).toString()).abi;

  const loanTxData = new ethers.Contract(LUKSO_LOAN_TX_DATA, abi);

  // ABI encode the function call to `transferOwnership`
  const data = loanTxData.interface.encodeFunctionData("transferOwnership", [loanAddress]);

  // Prepare to call `execute` on the Universal Profile
  const operationType = 0; // Call operation
  const to = LUKSO_LOAN_TX_DATA; // Address of the contract with the `transferOwnership` function
  const value = 0; // No ETH to be sent

  try {
    const tx = await universalProfile.execute(operationType, to, value, data);
    const receipt = await tx.wait();
    console.log('Transaction successful:', receipt);
    console.log(
      '✅ Ownership of loanTxData successfully transferred to Loan contract'
    );
  } catch (error) {
      console.error('Failed to execute transaction:', error);
  }

  // Transferring ownership of RWAVerification to Loan contract
  console.log('⏳ Transferring ownership of RWAVerification to Loan contract')
  const rwavAbiPath = "./artifacts/contracts/RWAVerification/RWAVerification.sol/RWAVerification.json";
  const rwavAbi = JSON.parse(fs.readFileSync(rwavAbiPath).toString()).abi;

  const rwaVerification = new ethers.Contract(LUKSO_RWA_VERIFICATION, rwavAbi);

  // ABI encode the function call to `transferOwnership`
  const rawvTransferOwnershipEncodedFunc = rwaVerification.interface.encodeFunctionData("transferOwnership", [loanAddress]);

  try {
    const tx = await universalProfile.execute(0, LUKSO_RWA_VERIFICATION, 0, rawvTransferOwnershipEncodedFunc);
    const receipt = await tx.wait();
    console.log('Transaction successful:', receipt);
    console.log(
      '✅ Ownership of RWAVerification successfully transferred to Loan contract'
    );
  } catch (error) {
      console.error('Failed to execute transaction:', error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
