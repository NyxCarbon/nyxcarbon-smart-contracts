import { HardhatUserConfig } from 'hardhat/config';
import { config as LoadEnv } from 'dotenv';
import '@nomicfoundation/hardhat-toolbox';
import "@openzeppelin/hardhat-upgrades";

LoadEnv();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.18',
    settings: {
      optimizer: {
        enabled: true
      },
      viaIR: true
    }
  },
  networks: {
    luksoTestnet: {
      url: 'https://rpc.testnet.lukso.network',
      chainId: 4201,
      accounts: [process.env.PRIVATE_KEY as string],
      allowUnlimitedContractSize: true,
    },
    peaq: {
      url: 'https://erpc-mpfn1.peaq.network',
      chainId: 3338,
      accounts: [process.env.PRIVATE_KEY as string],
      allowUnlimitedContractSize: true,
    },
  },
};

export default config;
