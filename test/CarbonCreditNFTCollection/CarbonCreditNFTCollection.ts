import { expect } from "chai";
import { ethers } from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { convertBytesToInt256, convertBytesToString } from "../utils";


describe("Carbon Credit NFT contract", function () {
  async function deployNFTCollectionFixture() {
    const NFTCollection = await ethers.getContractFactory("CarbonCreditNFTCollection");
    const [owner, addr1, addr2] = await ethers.getSigners();
    
    const hardhatNFTCollection = await NFTCollection.deploy("NyxCarbonCreditCollection", "NCCC", owner, owner);
    await hardhatNFTCollection.waitForDeployment();

    return { NFTCollection, hardhatNFTCollection, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { hardhatNFTCollection, owner } = await loadFixture(deployNFTCollectionFixture);
      expect(await hardhatNFTCollection.owner()).to.equal(owner.address);
    });
  });

  describe("Carbon Credit NFT minting", function () {
    it("Should mint a new carbon credit NFT", async function () {
      const { hardhatNFTCollection, owner } = await loadFixture(deployNFTCollectionFixture);

      const projectName = "Project Green";
      const registryLink = "http://registry.example.com";
      const units = "1000";
      const geographicIdentifier = "-14.235004, -51.92528";

      const tokenId = await hardhatNFTCollection.mintCarbonCreditNFT(owner.address, projectName, registryLink, units, geographicIdentifier);
      expect(await hardhatNFTCollection.tokenOwnerOf('0x0000000000000000000000000000000000000000000000000000000000000001')).to.equal(owner.address);
    });

    it("Should restrict who can mint carbon credit NFT", async function () {
      const { hardhatNFTCollection, owner, addr1 } = await loadFixture(deployNFTCollectionFixture);

      const projectName = "Project Green";
      const registryLink = "http://registry.example.com";
      const units = "1000";
      const geographicIdentifier = "-14.235004, -51.92528";

      await expect(hardhatNFTCollection.connect(addr1).mintCarbonCreditNFT(owner.address, projectName, registryLink, units, geographicIdentifier)).to.be.revertedWithCustomError(hardhatNFTCollection, 'OwnableCallerNotTheOwner').withArgs(addr1.address);
    });

    it("Should emit an event on minting", async function () {
      const { hardhatNFTCollection, owner, addr1 } = await loadFixture(deployNFTCollectionFixture);

      const projectName = "Project Green";
      const registryLink = "http://registry.example.com";
      const units = 1000;
      const geographicIdentifier = "-14.235004, -51.92528";

      await expect(hardhatNFTCollection.mintCarbonCreditNFT(addr1.address, projectName, registryLink, units, geographicIdentifier))
        .to.emit(hardhatNFTCollection, "Minted")
        .withArgs(addr1.address, '0x0000000000000000000000000000000000000000000000000000000000000001', projectName, registryLink, units, geographicIdentifier, [owner]);
    });

    it("Should allow minting to different addresses", async function () {
      const { hardhatNFTCollection, addr1, addr2 } = await loadFixture(deployNFTCollectionFixture);

      await hardhatNFTCollection.mintCarbonCreditNFT(addr1.address, "Project Green", "http://registry.example.com", "1000", "-14.235004, -51.92528");
      await hardhatNFTCollection.mintCarbonCreditNFT(addr2.address, "Project Blue", "http://registry.example.org", "500", "-14.235004, -51.92528");

      expect(await hardhatNFTCollection.tokenOwnerOf('0x0000000000000000000000000000000000000000000000000000000000000001')).to.equal(addr1.address);
      expect(await hardhatNFTCollection.tokenOwnerOf('0x0000000000000000000000000000000000000000000000000000000000000002')).to.equal(addr2.address);
    });

    it("Should only allow owner to mint NFTs", async function () {
      const { hardhatNFTCollection, addr1 } = await loadFixture(deployNFTCollectionFixture);

      // Should revert with OwnableCallerNotTheOwner since only the owner should be able to mint new NFTs
      await expect(hardhatNFTCollection.connect(addr1).mintCarbonCreditNFT(addr1.address, "Project Green", "http://registry.example.com", "1000", "-14.235004, -51.92528"))
        .to.be.revertedWithCustomError(hardhatNFTCollection, 'OwnableCallerNotTheOwner').withArgs(addr1.address);
    });
});

  describe("Retrieving Carbon Credit NFT Details", function () {
    it("Should allow owner to access carbon credit NFT metadata", async function () {
      const { hardhatNFTCollection, addr1 } = await loadFixture(deployNFTCollectionFixture);

      const projectName = "Project Green";
      const registryLink = "http://registry.example.com";
      const units = 1000;
      const geographicIdentifier = "-14.235004, -51.92528";

      const tokenId = await hardhatNFTCollection.mintCarbonCreditNFT(addr1.address, projectName, registryLink, units, geographicIdentifier);
      const nftMetadata = await hardhatNFTCollection.getCarbonCreditNFT('0x0000000000000000000000000000000000000000000000000000000000000001');

      expect(convertBytesToString(nftMetadata[0])).to.equal(projectName);
      expect(convertBytesToString(nftMetadata[1])).to.equal(registryLink);
      expect(convertBytesToInt256(nftMetadata[2])).to.equal(units);
    });

    it("Should allow addr2 to access carbon credit NFT metadata for addr1's NFT", async function () {
      const { hardhatNFTCollection, addr1, addr2 } = await loadFixture(deployNFTCollectionFixture);

      const projectName = "Project Green";
      const registryLink = "http://registry.example.com";
      const units = 1000;
      const geographicIdentifier = "-14.235004, -51.92528";

      await hardhatNFTCollection.mintCarbonCreditNFT(addr1.address, projectName, registryLink, units, geographicIdentifier);
      const nftMetadata = await hardhatNFTCollection.connect(addr2).getCarbonCreditNFT('0x0000000000000000000000000000000000000000000000000000000000000001');
      
      expect(convertBytesToString(nftMetadata[0])).to.equal(projectName);
      expect(convertBytesToString(nftMetadata[1])).to.equal(registryLink);
      expect(convertBytesToInt256(nftMetadata[2])).to.equal(units);
    });

    it("Should handle non-existent NFTs correctly", async function () {
      const { hardhatNFTCollection } = await loadFixture(deployNFTCollectionFixture);
      
      // Should revert with LSP8NonExistentTokenId since no NFTs have been minted yet
      await expect(hardhatNFTCollection.tokenOwnerOf('0x0000000000000000000000000000000000000000000000000000000000000001'))
        .to.be.revertedWithCustomError(hardhatNFTCollection, 'LSP8NonExistentTokenId').withArgs("0x0000000000000000000000000000000000000000000000000000000000000001");
    });
  });
});
