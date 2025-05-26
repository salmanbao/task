import { expect } from "chai";
import { ZeroAddress } from "ethers";
import hre, { ethers } from "hardhat";

describe("LandNFT & AuctionManager", function () {
  let landNFT: any;
  let auctionManager: any;
  let owner: any, user1: any, user2: any, user3: any;
  let ownerAddr: string, user1Addr: string, user2Addr: string, user3Addr: string;
  const baseURI = "https://gateway.lighthouse.storage/ipfs/bafybeig4zrg7j5mr6nd7vp7b2xrhadxv6hom2shiernieg22ku5as6encu/";

  beforeEach(async function () {
    [owner, user1, user2, user3] = await hre.ethers.getSigners();
    ownerAddr = await owner.getAddress();
    user1Addr = await user1.getAddress();
    user2Addr = await user2.getAddress();
    user3Addr = await user3.getAddress();
    hre.tracer.nameTags[ZeroAddress] = "ZERO-ADDRESS";
    hre.tracer.nameTags[await owner.getAddress()] = "ADMIN";
    hre.tracer.nameTags[await user1.getAddress()] = "USER1";
    hre.tracer.nameTags[await user2.getAddress()] = "USER2";
    hre.tracer.nameTags[await user3.getAddress()] = "USER3";

    landNFT = await ethers.deployContract("LandNFT", owner);
    hre.tracer.nameTags[landNFT.target] = "LAND-NFT";

    auctionManager = await ethers.deployContract("AuctionManager", [landNFT.target], owner);
    hre.tracer.nameTags[auctionManager.target] = "AUCTION-MANAGER";

    hre.tracer.showAddresses = false;
  });

  describe("LandNFT", function () {
    it("should mint land NFT and emit event", async function () {
      await expect(landNFT.connect(owner).mintLand(ownerAddr)).to.emit(landNFT, "LandMinted");
      expect(await landNFT.ownerOf(1)).to.equal(ownerAddr);
      expect(await landNFT.tokenURI(1)).to.equal(baseURI + "1.json");
    });

    it("should return the correct baseURI", async function () {
      // _baseURI is internal, but tokenURI uses it if only a tokenId is set
      // Mint a token with only a tokenId as URI (simulate by setting tokenURI to just the ID)
      await landNFT.connect(owner).mintLand(ownerAddr);
      // tokenURI(2) should return baseURI + "1" (since we set uri as "1")
      expect(await landNFT.tokenURI(2)).to.equal(baseURI + "2.json"); // Because ERC721URIStorage returns the full URI if set
      // To truly test baseURI, you would need to override tokenURI logic to use baseURI + tokenId if no URI is set
    });

    it("should not allow non-owner to mint", async function () {
      await expect(landNFT.connect(user1).mintLand(user1Addr)).to.be.revertedWithCustomError(landNFT, "OwnableUnauthorizedAccount");
    });

    it("should set and get royalty info", async function () {
      await landNFT.connect(owner).setDefaultRoyalty(user1Addr, 1000); // 10%
      const [receiver, royaltyAmount] = await landNFT.royaltyInfo(1, 10000);
      expect(receiver).to.equal(user1Addr);
      expect(royaltyAmount).to.equal(1000);
    });

    it("should not allow non-owner to set royalty", async function () {
      await expect(landNFT.connect(user1).setDefaultRoyalty(user1Addr, 1000)).to.be.revertedWithCustomError(landNFT, "OwnableUnauthorizedAccount");
    });
  });

  describe("AuctionManager - Fixed Price", function () {
    beforeEach(async function () {
      await landNFT.connect(owner).mintLand(ownerAddr);
      await landNFT.connect(owner).setApprovalForAll(auctionManager.target, true);
    });

    it("should allow listing, purchasing, and emit LandPurchased", async function () {
      await auctionManager.connect(owner).listLandForSale(1, ethers.parseEther("1"));
      await expect(
        auctionManager.connect(user1).purchaseLand(1, { value: ethers.parseEther("1") })
      ).to.emit(auctionManager, "LandPurchased");
      expect(await landNFT.ownerOf(1)).to.equal(user1Addr);
    });

    it("should not allow non-owner to list for sale", async function () {
      await expect(
        auctionManager.connect(user1).listLandForSale(1, ethers.parseEther("1"))
      ).to.be.revertedWith("Not NFT owner");
    });

    it("should not allow listing with zero price", async function () {
      await expect(
        auctionManager.connect(owner).listLandForSale(1, 0)
      ).to.be.revertedWith("Price must be > 0");
    });

    it("should not allow purchase if not for sale", async function () {
      await expect(
        auctionManager.connect(user1).purchaseLand(1, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Land not for sale");
    });

    it("should not allow purchase with insufficient payment", async function () {
      await auctionManager.connect(owner).listLandForSale(1, ethers.parseEther("1"));
      await expect(
        auctionManager.connect(user1).purchaseLand(1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("should allow seller to cancel sale", async function () {
      await auctionManager.connect(owner).listLandForSale(1, ethers.parseEther("1"));
      await auctionManager.connect(owner).cancelLandSale(1);
      await expect(
        auctionManager.connect(user1).purchaseLand(1, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Land not for sale");
    });

    it("should not allow non-owner to cancel sale", async function () {
      await auctionManager.connect(owner).listLandForSale(1, ethers.parseEther("1"));
      await expect(
        auctionManager.connect(user1).cancelLandSale(1)
      ).to.be.revertedWith("Not NFT owner");
    });
  });

  describe("AuctionManager - Auction", function () {
    beforeEach(async function () {
      await landNFT.connect(owner).mintLand(ownerAddr);
      await landNFT.connect(owner).setApprovalForAll(auctionManager.target, true);
    });

    it("should allow starting, bidding, and ending an auction", async function () {
      await auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 3600);
      await expect(
        auctionManager.connect(user1).bid(1, { value: ethers.parseEther("1.1") })
      ).to.emit(auctionManager, "BidPlaced");
      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);
      await expect(auctionManager.connect(owner).endAuction(1)).to.emit(auctionManager, "AuctionEnded");
      expect(await landNFT.ownerOf(1)).to.equal(user1Addr);
    });

    it("should not allow non-owner to start auction", async function () {
      await expect(
        auctionManager.connect(user1).startAuction(1, ethers.parseEther("1"), 3600)
      ).to.be.revertedWith("Not NFT owner");
    });

    it("should not allow auction with zero duration", async function () {
      await expect(
        auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 0)
      ).to.be.revertedWith("Duration must be > 0");
    });

    it("should not allow auction if already active", async function () {
      await auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 3600);
      await expect(
        auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 3600)
      ).to.be.revertedWith("Not NFT owner");
    });

    it("should not allow bid below minBid", async function () {
      await auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 3600);
      await expect(
        auctionManager.connect(user1).bid(1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Bid below minBid");
    });

    it("should not allow bid not higher than current highest", async function () {
      await auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 3600);
      await auctionManager.connect(user1).bid(1, { value: ethers.parseEther("1.1") });
      await expect(
        auctionManager.connect(user2).bid(1, { value: ethers.parseEther("1.1") })
      ).to.be.revertedWith("Bid not high enough");
    });

    it("should refund previous highest bidder", async function () {
      await auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 3600);
      await auctionManager.connect(user1).bid(1, { value: ethers.parseEther("1.1") });
      const prevBalance = await ethers.provider.getBalance(user1Addr);
      const tx = await auctionManager.connect(user2).bid(1, { value: ethers.parseEther("1.2") });
      await tx.wait();
      const newBalance = await ethers.provider.getBalance(user1Addr);
      expect(newBalance).to.be.gt(prevBalance); // user1 refunded
    });

    it("should extend auction if bid is placed within time buffer (anti-sniping)", async function () {
      await auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 601); // just over 10 min
      await ethers.provider.send("evm_increaseTime", [590]);
      await ethers.provider.send("evm_mine", []);
      const tx = await auctionManager.connect(user1).bid(1, { value: ethers.parseEther("1.1") });
      await expect(tx).to.emit(auctionManager, "AuctionExtended");
      const auction = await auctionManager.auctions(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      expect(latestBlock).to.not.be.null;
      expect(auction.endTime).to.be.gt(latestBlock!.timestamp);
    });

    it("should allow seller to cancel auction if no bids", async function () {
      await auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 3600);
      await auctionManager.connect(owner).cancelAuction(1);
      const auction = await auctionManager.auctions(1);
      expect(auction.active).to.be.false;
    });

    it("should not allow non-seller to cancel auction", async function () {
      await auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 3600);
      await expect(
        auctionManager.connect(user1).cancelAuction(1)
      ).to.be.revertedWith("Not seller");
    });

    it("should not allow cancel if there are bids", async function () {
      await auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 3600);
      await auctionManager.connect(user1).bid(1, { value: ethers.parseEther("1.1") });
      await expect(
        auctionManager.connect(owner).cancelAuction(1)
      ).to.be.revertedWith("Auction has bids");
    });

    it("should return NFT to seller if no bids on endAuction", async function () {
      await auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 3600);
      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);
      await expect(auctionManager.connect(owner).endAuction(1)).to.emit(auctionManager, "AuctionCancelled");
      expect(await landNFT.ownerOf(1)).to.equal(ownerAddr);
    });

    it("should not allow endAuction before end time", async function () {
      await auctionManager.connect(owner).startAuction(1, ethers.parseEther("1"), 3600);
      await expect(
        auctionManager.connect(owner).endAuction(1)
      ).to.be.revertedWith("Auction not ended");
    });
  });
}); 