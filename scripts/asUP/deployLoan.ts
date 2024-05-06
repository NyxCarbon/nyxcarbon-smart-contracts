import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

import LSP0Artifact from '@lukso/lsp-smart-contracts/artifacts/LSP0ERC725Account.json';
import { LUKSO_LOAN_NFT, LUKSO_CARBON_CREDIT_NFT } from '../asEOA/constants';

dotenv.config();
const { RPC_URL, PRIVATE_KEY, UP_ADDR } = process.env;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with Universal Profile controller: ', deployer.address);

  const universalProfile = await ethers.getContractAtFromArtifact(
    LSP0Artifact,
    UP_ADDR as string,
  );

  console.log('⏳ Deploying the Loan contract')
  const bytecode = (await ethers.getContractFactory('NonCollateralizedLoanNativeSimplified')).bytecode;

  const abiEncoder = new ethers.AbiCoder();
  const encodedConstructorParams = abiEncoder.encode(
    ['address', 'address'],
    [
      LUKSO_LOAN_NFT,
      LUKSO_CARBON_CREDIT_NFT
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
    '✅ Custom Loan contract successfully deployed at address: ',
    loanAddress,
  );

  // Transferring ownership of LoanNFT and CarbonCreditNFTCollection to Loan contract
    console.log('⏳ Transferring ownership of LoanNFT to Loan contract')
  const abiPath = "./artifacts/contracts/NonCollateralizedLoan/NonCollateralizedLoanNFT/NonCollaterlizedLoanNFT.sol/NonCollateralizedLoanNFT.json";
  const abi = JSON.parse(fs.readFileSync(abiPath).toString()).abi;

  const provider = new ethers.JsonRpcProvider(
      RPC_URL,
  );

  const EOA = new ethers.Wallet(PRIVATE_KEY as string, provider);
  const LoanNFT = new ethers.Contract(LUKSO_LOAN_NFT, abi);

  await LoanNFT.connect(EOA).transferOwnership(loanAddress);
  console.log(
    '✅ Ownership of LoanNFT successfully transferred to Loan contract'
  );

  console.log('⏳ Transferring ownership of CarbonCreditNFTCollection to Loan contract')
  const ccAbiPath = "./artifacts/contracts/CarbonCreditNFTCollection/CarbonCreditNFTCollection.sol/CarbonCreditNFTCollection.json";
  const ccAbi = JSON.parse(fs.readFileSync(ccAbiPath).toString()).abi;

  const CarbonCreditNFT = new ethers.Contract(LUKSO_CARBON_CREDIT_NFT, ccAbi);

  await CarbonCreditNFT.connect(EOA).transferOwnership(loanAddress);
  console.log(
    '✅ Ownership of CarbonCreditNFTCollection successfully transferred to Loan contract'
  );


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
