import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
const fs = require("fs");

dotenv.config();
const { PRIVATE_KEY } = process.env;

async function main() {
    const abiPath = "./artifacts/contracts/CarbonCreditNFTCollection/CarbonCreditNFTCollection.sol/CarbonCreditNFTCollection.json";
    const abi = JSON.parse(fs.readFileSync(abiPath).toString()).abi;

    const provider = new ethers.JsonRpcProvider(
        'https://rpc.testnet.lukso.network',
    );

    const EOA = new ethers.Wallet(PRIVATE_KEY as string, provider);
    const NFT = new ethers.Contract("0xAFD7a4762629C3389C9f1964E3282f8706294dCa", abi);

    await NFT.connect(EOA).transferOwnership('0x6165c6c67365e5c1C39419397da0AfB0EeBb7FC1');
    console.log(`Ownership transfer complete.`)

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
