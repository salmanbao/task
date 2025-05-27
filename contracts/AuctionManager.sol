// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

interface ILandNFT is IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

contract AuctionManager is ReentrancyGuard {
    struct Auction {
        address seller;
        uint256 minBid;
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool active;
    }

    ILandNFT public landNFT;
    IERC2981 public royaltyNFT;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => uint256) public landPrices;
    mapping(uint256 => bool) public forSale;

    uint256 public constant timeBuffer = 600; // 10 minutes in seconds

    event LandPurchased(address indexed buyer, uint256 indexed tokenId, uint256 price);
    event AuctionStarted(uint256 indexed tokenId, address indexed seller, uint256 minBid, uint256 endTime);
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed tokenId, address winner, uint256 amount);
    event AuctionCancelled(uint256 indexed tokenId);
    event AuctionExtended(uint256 indexed tokenId, uint256 newEndTime);

    constructor(address _landNFT) {
        landNFT = ILandNFT(_landNFT);
        royaltyNFT = IERC2981(_landNFT);
    }

    // Fixed-price sale functions
    function listLandForSale(uint256 tokenId, uint256 price) external {
        require(landNFT.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        require(price > 0, "Price must be > 0");
        landPrices[tokenId] = price;
        forSale[tokenId] = true;
    }

    function cancelLandSale(uint256 tokenId) external {
        require(landNFT.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        forSale[tokenId] = false;
        landPrices[tokenId] = 0;
    }

    function purchaseLand(uint256 tokenId) external payable nonReentrant {
        require(forSale[tokenId], "Land not for sale");
        uint256 price = landPrices[tokenId];
        require(msg.value >= price, "Insufficient payment");
        address seller = landNFT.ownerOf(tokenId);
        forSale[tokenId] = false;
        landPrices[tokenId] = 0;
        landNFT.safeTransferFrom(seller, msg.sender, tokenId);
        (address royaltyReceiver, uint256 royaltyAmount) = royaltyNFT.royaltyInfo(tokenId, price);
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            payable(royaltyReceiver).transfer(royaltyAmount);
            payable(seller).transfer(price - royaltyAmount);
        } else {
            payable(seller).transfer(price);
        }
        emit LandPurchased(msg.sender, tokenId, price);
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
    }

    // Auction functions
    function startAuction(uint256 tokenId, uint256 minBid, uint256 duration) external {
        require(landNFT.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        require(auctions[tokenId].active == false, "Auction already active");
        require(duration > 0, "Duration must be > 0");

        landNFT.safeTransferFrom(msg.sender, address(this), tokenId);
        auctions[tokenId] = Auction({
            seller: msg.sender,
            minBid: minBid,
            highestBid: 0,
            highestBidder: address(0),
            endTime: block.timestamp + duration,
            active: true
        });
        emit AuctionStarted(tokenId, msg.sender, minBid, block.timestamp + duration);
    }

    function bid(uint256 tokenId) external payable nonReentrant {
        Auction storage auction = auctions[tokenId];
        require(auction.active, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.value >= auction.minBid, "Bid below minBid");
        require(msg.value > auction.highestBid, "Bid not high enough");

        if (auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }
        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;
        emit BidPlaced(tokenId, msg.sender, msg.value);

        // Anti-sniping: extend auction if bid placed within timeBuffer
        if (auction.endTime - block.timestamp < timeBuffer) {
            auction.endTime = block.timestamp + timeBuffer;
            emit AuctionExtended(tokenId, auction.endTime);
        }
    }

    function endAuction(uint256 tokenId) external nonReentrant {
        Auction storage auction = auctions[tokenId];
        require(auction.active, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");

        auction.active = false;
        if (auction.highestBidder != address(0)) {
            landNFT.safeTransferFrom(address(this), auction.highestBidder, tokenId);
            (address royaltyReceiver, uint256 royaltyAmount) = royaltyNFT.royaltyInfo(tokenId, auction.highestBid);
            if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
                payable(royaltyReceiver).transfer(royaltyAmount);
                payable(auction.seller).transfer(auction.highestBid - royaltyAmount);
            } else {
                payable(auction.seller).transfer(auction.highestBid);
            }
            emit AuctionEnded(tokenId, auction.highestBidder, auction.highestBid);
        } else {
            landNFT.safeTransferFrom(address(this), auction.seller, tokenId);
            emit AuctionCancelled(tokenId);
        }
    }

    function cancelAuction(uint256 tokenId) external nonReentrant {
        Auction storage auction = auctions[tokenId];
        require(auction.active, "Auction not active");
        require(auction.seller == msg.sender, "Not seller");
        require(auction.highestBidder == address(0), "Auction has bids");

        auction.active = false;
        landNFT.safeTransferFrom(address(this), auction.seller, tokenId);
        emit AuctionCancelled(tokenId);
    }

    function onERC721Received(address, address, uint256, bytes memory) public virtual returns (bytes4) {
        return this.onERC721Received.selector;
    }
} 