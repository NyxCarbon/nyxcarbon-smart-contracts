import { expect } from "chai";
import { ethers } from "hardhat";
import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { convertBytesToInt256, convertBytesToString } from "../utils";


describe("Real World Asset Verification NFT contract", function () {
  async function deployNFTCollectionFixture() {
    const NFTCollection = await ethers.getContractFactory("RWAVerification");
    const [owner, addr1, addr2] = await ethers.getSigners();
    
    const hardhatNFTCollection = await NFTCollection.deploy("RWAVerification", "RWAV", owner, owner);
    await hardhatNFTCollection.waitForDeployment();

    return { NFTCollection, hardhatNFTCollection, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { hardhatNFTCollection, owner } = await loadFixture(deployNFTCollectionFixture);
      expect(await hardhatNFTCollection.owner()).to.equal(owner.address);
    });
  });

  describe("Real World Asset Verification NFT minting", function () {
    it("Should mint a new Real World Asset Verification NFT", async function () {
      const { hardhatNFTCollection, owner } = await loadFixture(deployNFTCollectionFixture);

      const projectName = "Project Green";
      const projectLink = "http://project.example.com";
      const units = "1000";
      const geographicIdentifier = "-14.235004, -51.92528";

      const tokenId = await hardhatNFTCollection.mintNFT(owner.address, projectName, projectLink, units, geographicIdentifier);
      expect(await hardhatNFTCollection.tokenOwnerOf('0x0000000000000000000000000000000000000000000000000000000000000001')).to.equal(owner.address);
    });

    it("Should restrict who can mint Real World Asset Verification NFT", async function () {
      const { hardhatNFTCollection, owner, addr1 } = await loadFixture(deployNFTCollectionFixture);

      const projectName = "Project Green";
      const projectLink = "http://project.example.com";
      const units = "1000";
      const geographicIdentifier = "-14.235004, -51.92528";

      await expect(hardhatNFTCollection.connect(addr1).mintNFT(owner.address, projectName, projectLink, units, geographicIdentifier)).to.be.revertedWithCustomError(hardhatNFTCollection, 'OwnableCallerNotTheOwner').withArgs(addr1.address);
    });

    it("Should emit an event on minting", async function () {
      const { hardhatNFTCollection, owner, addr1 } = await loadFixture(deployNFTCollectionFixture);

      const projectName = "Project Green";
      const projectLink = "http://project.example.com";
      const units = 1000;
      const geographicIdentifier = "-14.235004, -51.92528";

      await expect(hardhatNFTCollection.mintNFT(addr1.address, projectName, projectLink, units, geographicIdentifier))
        .to.emit(hardhatNFTCollection, "Minted")
        .withArgs(addr1.address, '0x0000000000000000000000000000000000000000000000000000000000000001', projectName, projectLink, units, geographicIdentifier, [owner]);
    });

    it("Should allow minting to different addresses", async function () {
      const { hardhatNFTCollection, addr1, addr2 } = await loadFixture(deployNFTCollectionFixture);

      await hardhatNFTCollection.mintNFT(addr1.address, "Project Green", "http://project.example.com", "1000", "-14.235004, -51.92528");
      await hardhatNFTCollection.mintNFT(addr2.address, "Project Blue", "http://project.example.org", "500", "-14.235004, -51.92528");

      expect(await hardhatNFTCollection.tokenOwnerOf('0x0000000000000000000000000000000000000000000000000000000000000001')).to.equal(addr1.address);
      expect(await hardhatNFTCollection.tokenOwnerOf('0x0000000000000000000000000000000000000000000000000000000000000002')).to.equal(addr2.address);
    });

    it("Should only allow owner to mint NFTs", async function () {
      const { hardhatNFTCollection, addr1 } = await loadFixture(deployNFTCollectionFixture);

      // Should revert with OwnableCallerNotTheOwner since only the owner should be able to mint new NFTs
      await expect(hardhatNFTCollection.connect(addr1).mintNFT(addr1.address, "Project Green", "http://project.example.com", "1000", "-14.235004, -51.92528"))
        .to.be.revertedWithCustomError(hardhatNFTCollection, 'OwnableCallerNotTheOwner').withArgs(addr1.address);
    });
});

  describe("Retrieving Real World Asset Verification NFT Details", function () {
    it("Should allow owner to access Real World Asset Verification NFT metadata", async function () {
      const { hardhatNFTCollection, addr1 } = await loadFixture(deployNFTCollectionFixture);

      const projectName = "Project Green";
      const projectLink = "http://project.example.com";
      const units = 1000;
      const geographicIdentifier = "-14.235004, -51.92528";

      const tokenId = await hardhatNFTCollection.mintNFT(addr1.address, projectName, projectLink, units, geographicIdentifier);
      const nftMetadata = await hardhatNFTCollection.getNFT('0x0000000000000000000000000000000000000000000000000000000000000001');

      expect(convertBytesToString(nftMetadata[0])).to.equal(projectName);
      expect(convertBytesToString(nftMetadata[1])).to.equal(projectLink);
      expect(convertBytesToInt256(nftMetadata[2])).to.equal(units);
    });

    it("Should allow addr2 to access Real World Asset Verification NFT metadata for addr1's NFT", async function () {
      const { hardhatNFTCollection, addr1, addr2 } = await loadFixture(deployNFTCollectionFixture);

      const projectName = "Project Green";
      const projectLink = "http://project.example.com";
      const units = 1000;
      const geographicIdentifier = "-14.235004, -51.92528";

      await hardhatNFTCollection.mintNFT(addr1.address, projectName, projectLink, units, geographicIdentifier);
      const nftMetadata = await hardhatNFTCollection.connect(addr2).getNFT('0x0000000000000000000000000000000000000000000000000000000000000001');
      
      expect(convertBytesToString(nftMetadata[0])).to.equal(projectName);
      expect(convertBytesToString(nftMetadata[1])).to.equal(projectLink);
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
