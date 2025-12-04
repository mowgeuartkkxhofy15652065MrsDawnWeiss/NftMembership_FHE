// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract NftMembershipFHE is SepoliaConfig {
    struct EncryptedMembership {
        uint256 tokenId;
        euint32 encryptedLevel; // Encrypted membership level
        euint32 encryptedPrivileges; // Encrypted privileges
        uint256 timestamp;
    }

    struct DecryptedMembership {
        string level;
        string privileges;
        bool isRevealed;
    }

    uint256 public membershipCount;
    mapping(uint256 => EncryptedMembership) public encryptedMemberships;
    mapping(uint256 => DecryptedMembership) public decryptedMemberships;

    mapping(string => euint32) private encryptedLevelCounts;
    string[] private memberList;

    mapping(uint256 => uint256) private requestToTokenId;

    event MembershipMinted(uint256 indexed tokenId, uint256 timestamp);
    event DecryptionRequested(uint256 indexed tokenId);
    event MembershipDecrypted(uint256 indexed tokenId);

    modifier onlyMember(uint256 tokenId) {
        _;
    }

    /// @notice Mint a new encrypted membership NFT
    function mintEncryptedMembership(
        euint32 encryptedLevel,
        euint32 encryptedPrivileges
    ) public {
        membershipCount += 1;
        uint256 newTokenId = membershipCount;

        encryptedMemberships[newTokenId] = EncryptedMembership({
            tokenId: newTokenId,
            encryptedLevel: encryptedLevel,
            encryptedPrivileges: encryptedPrivileges,
            timestamp: block.timestamp
        });

        decryptedMemberships[newTokenId] = DecryptedMembership({
            level: "",
            privileges: "",
            isRevealed: false
        });

        emit MembershipMinted(newTokenId, block.timestamp);
    }

    /// @notice Request decryption of membership data
    function requestMembershipDecryption(uint256 tokenId) public onlyMember(tokenId) {
        EncryptedMembership storage membership = encryptedMemberships[tokenId];
        require(!decryptedMemberships[tokenId].isRevealed, "Already decrypted");

        bytes32[] memory ciphertexts = new bytes32[](2);
        ciphertexts[0] = FHE.toBytes32(membership.encryptedLevel);
        ciphertexts[1] = FHE.toBytes32(membership.encryptedPrivileges);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptMembership.selector);
        requestToTokenId[reqId] = tokenId;

        emit DecryptionRequested(tokenId);
    }

    /// @notice Callback for decrypted membership
    function decryptMembership(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 tokenId = requestToTokenId[requestId];
        require(tokenId != 0, "Invalid request");

        EncryptedMembership storage eMembership = encryptedMemberships[tokenId];
        DecryptedMembership storage dMembership = decryptedMemberships[tokenId];
        require(!dMembership.isRevealed, "Already decrypted");

        FHE.checkSignatures(requestId, cleartexts, proof);

        string[] memory results = abi.decode(cleartexts, (string[]));
        dMembership.level = results[0];
        dMembership.privileges = results[1];
        dMembership.isRevealed = true;

        if (!FHE.isInitialized(encryptedLevelCounts[results[0]])) {
            encryptedLevelCounts[results[0]] = FHE.asEuint32(0);
            memberList.push(results[0]);
        }
        encryptedLevelCounts[results[0]] = FHE.add(
            encryptedLevelCounts[results[0]],
            FHE.asEuint32(1)
        );

        emit MembershipDecrypted(tokenId);
    }

    /// @notice Get decrypted membership info
    function getDecryptedMembership(uint256 tokenId) public view returns (
        string memory level,
        string memory privileges,
        bool isRevealed
    ) {
        DecryptedMembership storage m = decryptedMemberships[tokenId];
        return (m.level, m.privileges, m.isRevealed);
    }

    /// @notice Get encrypted membership level count
    function getEncryptedLevelCount(string memory level) public view returns (euint32) {
        return encryptedLevelCounts[level];
    }

    /// @notice Request decryption of level count
    function requestLevelCountDecryption(string memory level) public {
        euint32 count = encryptedLevelCounts[level];
        require(FHE.isInitialized(count), "Level not found");

        bytes32[] memory ciphertexts = new bytes32[](1);
        ciphertexts[0] = FHE.toBytes32(count);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptLevelCount.selector);
        requestToTokenId[reqId] = bytes32ToUint(keccak256(abi.encodePacked(level)));
    }

    /// @notice Callback for decrypted level count
    function decryptLevelCount(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 levelHash = requestToTokenId[requestId];
        string memory level = getLevelFromHash(levelHash);

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32 count = abi.decode(cleartexts, (uint32));
        // Handle decrypted count as needed
    }

    function bytes32ToUint(bytes32 b) private pure returns (uint256) {
        return uint256(b);
    }

    function getLevelFromHash(uint256 hash) private view returns (string memory) {
        for (uint i = 0; i < memberList.length; i++) {
            if (bytes32ToUint(keccak256(abi.encodePacked(memberList[i]))) == hash) {
                return memberList[i];
            }
        }
        revert("Level not found");
    }
}
