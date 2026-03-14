// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Wrapper} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Wrapper.sol";
import {ERC721Votes} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Votes.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title WrappedVerseNFT
/// @notice Wraps VerseNFT (plain ERC-721) into an ERC-721Votes token for use with DaoDeGenGovernor.
/// @dev STATUS: STUB — not deployed. Deploy when transitioning from Snapshot + Safe to on-chain governance.
///
///      Mechanism:
///        Wrap:   nft.approve(address(this), tokenId) then wrappedNFT.depositFor(holder, [tokenId])
///                or simply nft.safeTransferFrom(holder, address(wrappedNFT), tokenId)
///        Unwrap: wrappedNFT.withdrawTo(holder, [tokenId])
///
///      Voting power is checkpointed at deposit; holders must self-delegate (or delegate to another
///      address) before their votes count. Delegation call: wrappedNFT.delegate(holder).
///
///      All 81 VerseNFT holders must wrap and delegate before their vote counts in the Governor.
///      On Unichain gas costs are negligible (~$0.01 per wrap + delegate pair).
contract WrappedVerseNFT is ERC721, ERC721Wrapper, ERC721Votes {
    constructor(IERC721 verseNFT)
        ERC721("Wrapped Dao DeGen Verse", "wVERSE")
        ERC721Wrapper(verseNFT)
        EIP712("WrappedVerseNFT", "1")
    {}

    // -------------------------------------------------------------------------
    // Required overrides for ERC721 + ERC721Wrapper + ERC721Votes diamond
    // -------------------------------------------------------------------------

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Votes)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Votes)
    {
        super._increaseBalance(account, value);
    }
}
