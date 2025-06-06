// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract LandNFT is ERC721, ERC721URIStorage, ERC721Royalty, Ownable {
    
    uint256 private _tokenIdCounter;
    string private _customBaseURI = "https://gateway.lighthouse.storage/ipfs/bafybeigsx2gmfxauqithxpsqyzirqjfvqfvf7znckpzcqgwc5zhqnepd2q/";

    event LandMinted(address indexed to, uint256 indexed tokenId, string uri);

    constructor() ERC721("LandParcel", "LAND") Ownable(msg.sender) {
        _setDefaultRoyalty(msg.sender, 500); // 5% (denominated in basis points)
    }

    function mintLand(
        address to
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);
        string memory baseURI = _baseURI();
        emit LandMinted(to, tokenId, string.concat(baseURI, Strings.toString(tokenId), ".json"));
        return tokenId;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        string memory baseURI = _baseURI();
        return string.concat(baseURI, Strings.toString(tokenId), ".json");
    }

    function _baseURI() internal view override returns (string memory) {
        return _customBaseURI;
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeNumerator) external onlyOwner {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _customBaseURI = newBaseURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 