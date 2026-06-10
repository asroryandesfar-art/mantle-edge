// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LogRegistry
/// @notice Minimal append-only event log for autonomous agent actions.
/// @dev Each call simply emits an `ActionLogged` event; no state is stored
/// on-chain beyond the events themselves. This gives the multi-agent
/// trading system (see apps/agent/src/multiagent) a tamper-evident,
/// publicly queryable audit trail of every trade decision it acts on.
/// `amount` and `price` are fixed-point values scaled by 1e6.
contract LogRegistry {
    event ActionLogged(
        address indexed agent,
        string action,
        string asset,
        int256 amount,
        int256 price,
        string note,
        uint256 timestamp
    );

    /// @notice Records an agent action as an on-chain event.
    /// @param action Short action label, e.g. "OPEN" or "CLOSE".
    /// @param asset Trading pair, e.g. "MNT/USDT".
    /// @param amount Trade size, scaled by 1e6.
    /// @param price Reference price, scaled by 1e6.
    /// @param note Free-form human-readable context (e.g. risk reasoning).
    function logAction(
        string calldata action,
        string calldata asset,
        int256 amount,
        int256 price,
        string calldata note
    ) external {
        emit ActionLogged(msg.sender, action, asset, amount, price, note, block.timestamp);
    }
}
