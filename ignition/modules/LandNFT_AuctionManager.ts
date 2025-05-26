import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LandNFT_AuctionManager = buildModule("LandNFT_AuctionManager", (m) => {
  const landNFT = m.contract("LandNFT");
  const auctionManager = m.contract("AuctionManager", [landNFT]);

  return { landNFT, auctionManager };
});

export default LandNFT_AuctionManager; 