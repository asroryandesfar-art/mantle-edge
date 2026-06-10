// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title TradeLogger
/// @notice Append-only event log for the trading agent's
/// decisions and executions. No state is stored on-chain beyond the events
/// themselves. `assetHash` supports filtering while `asset` remains readable.
contract TradeLogger is Ownable {
    event DecisionLogged(
        address indexed agent,
        bytes32 indexed assetHash,
        string asset,
        string direction,
        uint256 confidence,
        string reasoning,
        uint256 timestamp
    );

    event ExecutionLogged(
        address indexed agent,
        bytes32 indexed assetHash,
        bool indexed success,
        string asset,
        uint256 amount,
        uint256 price,
        uint256 timestamp
    );

    constructor() Ownable(msg.sender) {}

    /// @notice Records a MarketAnalyst/RiskManager decision as an on-chain event.
    /// @param asset Trading pair, e.g. "MNT/USDT".
    /// @param direction "LONG", "SHORT", or "WAIT".
    /// @param confidence Confidence score, 0-100.
    /// @param reasoning Human-readable rationale for the decision.
    function logDecision(
        string calldata asset,
        string calldata direction,
        uint256 confidence,
        string calldata reasoning
    ) external onlyOwner {
        emit DecisionLogged(msg.sender, keccak256(bytes(asset)), asset, direction, confidence, reasoning, block.timestamp);
    }

    /// @notice Records an executed (or attempted) trade as an on-chain event.
    /// @param asset Trading pair, e.g. "MNT/USDT".
    /// @param amount Trade size, scaled by 1e6.
    /// @param price Reference price, scaled by 1e6.
    /// @param success Whether the execution succeeded.
    function logExecution(string calldata asset, uint256 amount, uint256 price, bool success) external onlyOwner {
        emit ExecutionLogged(msg.sender, keccak256(bytes(asset)), success, asset, amount, price, block.timestamp);
    }
}
