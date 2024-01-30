import { ethers } from 'hardhat';

async function main() {
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];

  console.log('⏳ Deploying the LoanNFT library')

  const NFTContractFactory = await ethers.getContractFactory("NonCollateralizedLoanNFT");
  const NFT = await NFTContractFactory.deploy("NYXLoanNativeNFT", "NYXLN", deployer);
  await NFT.waitForDeployment();

  console.log(
    '✅ Custom LoanNFT successfully deployed at address: ',
    await NFT.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
