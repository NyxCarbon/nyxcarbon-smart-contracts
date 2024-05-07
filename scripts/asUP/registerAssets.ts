import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

import LSP0Artifact from '@lukso/lsp-smart-contracts/artifacts/LSP0ERC725Account.json';
import LSP12Schema from '@erc725/erc725.js/schemas/LSP12IssuedAssets.json';
import { ERC725 } from '@erc725/erc725.js';
import { INTERFACE_IDS } from '@lukso/lsp-smart-contracts';
import { LUKSO_RWA_VERIFICATION } from '../asUP/constants';

dotenv.config();
const { RPC_URL, PRIVATE_KEY, UP_ADDR } = process.env;

async function main() {
  console.log('Updating LSP12IssuedAssets[] with new RAWVerification address');

  // We will register the issued assets by setting the following LSP12 data keys
  // - LSP12IssuedAssets[]
  // - LSP12IssuedAssetsMap:<asset-address>

  // add the type of asset (LSP7 or LSP8) and their address in the object list below
  const issuedAssets = [
    {
        interfaceId: INTERFACE_IDS.LSP8IdentifiableDigitalAsset,
        address: LUKSO_RWA_VERIFICATION,
    },
  ];

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const myWallet = new ethers.Wallet(PRIVATE_KEY, provider);

  // 1. encode the data keys related to LSP12IssuedAssets[]
  const erc725 = new ERC725(
    LSP12Schema,
    UP_ADDR,
    RPC_URL,
    {
      ipfsGateway: 'https://api.universalprofile.cloud/ipfs',
    },
  );

  const allAssetAddresses = issuedAssets.map((asset) => asset.address);

  const issuedAssetsMap = issuedAssets.map((asset, index) => {
    return {
      keyName: 'LSP12IssuedAssetsMap:<address>',
      dynamicKeyParts: asset.address,
      value: [asset.interfaceId, ERC725.encodeValueType('uint128', index)],
    };
  });

  const { keys: lsp12DataKeys, values: lsp12Values } = erc725.encodeData([
    { keyName: 'LSP12IssuedAssets[]', value: allAssetAddresses },
    ...issuedAssetsMap,
  ]);

  // 2. create an instance of your Universal Profile contract
  const myUPContract = new ethers.Contract(
    UP_ADDR,
    LSP0Artifact.abi,
    myWallet,
  );

// 3. set these data keys created at step 1. using `setDataBatch` on the UP address
await myUPContract.setDataBatch(lsp12DataKeys, lsp12Values);

console.log('✅ rwaVerification contract added to LSP12IssuedAssets[]');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
