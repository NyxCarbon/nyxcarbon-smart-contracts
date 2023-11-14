import LSP7Mintable from '@lukso/lsp-smart-contracts/artifacts/LSP7Mintable.json';
import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();
const { UP_ADDR, PRIVATE_KEY, TOKEN_ADDR } = process.env;

async function main() {
    const provider = new ethers.JsonRpcProvider(
        'https://rpc.testnet.lukso.network',
    );
    // Setup EOA & get token contract
    const myEOA = new ethers.Wallet(PRIVATE_KEY as string, provider);
    const myToken = new ethers.Contract(TOKEN_ADDR as string, LSP7Mintable.abi);
    
    // Deploy NYX token (20000 coins go to owner when created)
    try{
      const balance = await myToken.connect(myEOA).balanceOf(myEOA);
      console.log('Owner Balance: ', Number(balance) / 1e18);
    } catch (error) {
      console.error(error);
    }
    
    // Mint tokens and send to UP
    try {
      await myToken.connect(myEOA).mint(UP_ADDR as string, 500, false, '0x');
      const upSupply = await myToken.connect(myEOA).balanceOf(UP_ADDR);
      console.log('UP Balance: ', upSupply);
    } catch (error) {
      console.error(error);
    }

    // Get total supply (20500)
    try {
      let supply = await myToken.connect(myEOA).totalSupply();
      console.log('Total Supply: ', Number(supply) / 1e18);
    } catch (error) {
      console.error(error);
    }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });