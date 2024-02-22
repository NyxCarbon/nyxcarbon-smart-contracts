import { ethers } from 'hardhat';

async function main() {
    const tokenId1 = "0x0000000000000000000000000000000000000000000000000000000000000001";
    const _NYX_LENDER = "0x3d4ae42dee4156a448efc6820621c2bb68ddb71f0a85333f1c5ac246fc70519d";

    const NFT = (await ethers.getContractFactory("NonCollateralizedLoanNFT")).attach("0xAFD7a4762629C3389C9f1964E3282f8706294dCa");
    const lender = await NFT.getDecodedAddress(tokenId1, _NYX_LENDER);
    
    console.log(`Lender: ${lender}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
