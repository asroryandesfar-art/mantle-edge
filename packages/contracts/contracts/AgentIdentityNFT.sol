// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentIdentityNFT
/// @notice Simplified, ERC-8004-inspired ERC-721 identity for a single
/// autonomous trading agent. Exactly one identity token (`AGENT_TOKEN_ID`) is
/// minted to the deployer on construction. The current token owner periodically
/// updates the agent's cumulative trading statistics.
/// @dev See https://eips.ethereum.org/EIPS/eip-8004 for the broader
/// Trustless Agents standard this identity model is inspired by.
contract AgentIdentityNFT is ERC721, Ownable {
    /// @notice Token ID of the single agent identity minted on deployment.
    uint256 public constant AGENT_TOKEN_ID = 1;

    /// @notice Human-readable name for this agent.
    string public agentName;

    /// @notice Unix timestamp (seconds) when this agent identity was deployed.
    uint256 public immutable deployedAt;

    /// @notice Cumulative number of trades the agent has executed.
    uint256 public totalTrades;

    /// @notice Cumulative realized PnL, scaled by 1e6 (matches TradeLogger).
    int256 public totalPnL;

    event AgentStatUpdated(uint256 indexed tokenId, int256 pnl, uint256 tradeCount, uint256 timestamp);

    error InvalidAgentTokenId(uint256 tokenId);
    error UnauthorizedStatsUpdater(address account);
    error StaleStatsUpdate(uint256 currentTradeCount, uint256 suppliedTradeCount);
    error ConflictingStatsUpdate(uint256 tradeCount, int256 currentPnL, int256 suppliedPnL);

    constructor(string memory agentName_) ERC721("Mantle Edge Agent", "MEA") Ownable(msg.sender) {
        agentName = agentName_;
        deployedAt = block.timestamp;
        _safeMint(msg.sender, AGENT_TOKEN_ID);
    }

    /// @notice Updates the agent's cumulative trading statistics.
    /// @param tokenId Must equal `AGENT_TOKEN_ID` (this contract mints a single identity).
    /// @param pnl New cumulative realized PnL, scaled by 1e6.
    /// @param tradeCount New cumulative trade count.
    function updateStats(uint256 tokenId, int256 pnl, uint256 tradeCount) external {
        if (tokenId != AGENT_TOKEN_ID) revert InvalidAgentTokenId(tokenId);
        if (msg.sender != ownerOf(tokenId)) revert UnauthorizedStatsUpdater(msg.sender);
        if (tradeCount < totalTrades) revert StaleStatsUpdate(totalTrades, tradeCount);
        if (tradeCount == totalTrades && pnl != totalPnL) {
            revert ConflictingStatsUpdate(tradeCount, totalPnL, pnl);
        }

        totalPnL = pnl;
        totalTrades = tradeCount;
        emit AgentStatUpdated(tokenId, pnl, tradeCount, block.timestamp);
    }
}
