# Sample Hardhat Project

## Contract Overview

### LandNFT.sol
- ERC-721 compliant NFT contract for representing unique land parcels.
- Allows the contract owner to mint new land NFTs with a URI.
- Supports royalty payments (ERC-2981) with configurable default and per-token royalties.
- Stores metadata for each land parcel (name, coordinates, size, URI).
- Only the contract owner can mint or set royalties.

### AuctionManager.sol
- Manages fixed-price sales and auctions for LandNFT tokens.
- Allows NFT owners to list their land for sale at a fixed price or start an auction.
- Handles bidding, anti-sniping (auction time extension), and refunds to outbid bidders.
- Transfers NFTs and payments securely using ReentrancyGuard.
- Emits events for all major actions (listing, purchase, auction start/end, bids, cancellations).
- Only the NFT owner can list, sell, or start/cancel auctions for their tokens.

### Interactions
- AuctionManager interacts with LandNFT to transfer ownership during sales and auctions.
- Users must approve AuctionManager to transfer their NFTs before listing or auctioning.

## Design Decisions

### Architecture
- **Separation of Concerns:** LandNFT is responsible for NFT logic and metadata, while AuctionManager handles sales and auctions. This modularity maintain the loose couple design pattern.
- **OpenZeppelin Inheritance:** LandNFT leverages OpenZeppelin's ERC721, ERC721URIStorage, ERC721Royalty, and Ownable for security and standards compliance.
- **Interface Usage:** AuctionManager interacts with LandNFT via an interface, enabling loose coupling and future extensibility.

### Security
- **Access Control:** Only the contract owner can mint or set royalties; only NFT owners can list or auction their tokens.
- **Reentrancy Protection:** All payable functions in AuctionManager use ReentrancyGuard to prevent reentrancy attacks.
- **Anti-Sniping:** Auctions automatically extend if a bid is placed near the end, ensuring fair participation (simple way to migtigate the Snipping attack for NFTs).
- **Refunds:** Outbid users are automatically refunded, and excess payments are returned to buyers and smart contract just keep the amount of the highest bidder instead of all bidders, it also saves the gas fee and minimize the bulky transactions for refunding.

### Gas Optimization
- **Efficient Storage:** Uses mappings and packed structs to minimize storage costs.
- **Minimal External Calls:** Reduces unnecessary contract interactions and emits only essential events.

### Extensibility
- **Royalty Support:** Implements ERC-2981 for marketplace compatibility and supports both default and per-token royalties.
- **Metadata Flexibility:** Uses URI-based metadata for off-chain extensibility.

## Deployment

To deploy the smart contracts, use the provided Hardhat Ignition module and yarn scripts. You can deploy to a local or remote network as follows:

1. **Compile the contracts:**
   ```shell
   yarn build
   ```
2. **Deploy using Hardhat Ignition:**
   ```shell
   yarn deploy:network <network-name>
   ```
   Replace `<network-name>` with your desired network (e.g., `localhost`, `sepolia`, etc.).
   This will deploy the contracts using the `ignition/modules/LandNFT_AuctionManager.ts` module.

3. **Verify the contracts (optional):**
   ```shell
   yarn verify:network <network-name>
   ```

Make sure to configure your network settings in `hardhat.config.ts` and set up any required environment variables (such as RPC URLs and private keys) in a `.env` file.

## Testing

To run the test suite for the smart contracts, use the following yarn scripts:

- **Run all tests:**
  ```shell
  yarn test
  ```
- **Run tests with verbose logs (tracing):**
  ```shell
  yarn test:logs
  ```
- **Run tests with gas reporting:**
  ```shell
  REPORT_GAS=true yarn test
  ```

The tests are located in the `test/` directory and cover minting, sales, auctions, royalties, and edge cases for both contracts.

## Usage

```shell
yarn build
yarn clean
yarn test
yarn test:logs
```
