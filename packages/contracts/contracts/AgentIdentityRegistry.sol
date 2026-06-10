// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title AgentIdentityRegistry
/// @notice ERC-8004-inspired on-chain identity registry for autonomous agents.
/// @dev Each registered agent is represented by an ERC-721 token. The token
/// owner controls the agent's off-chain metadata URI (e.g. an A2A "agent
/// card" pinned on IPFS) and the on-chain "agent address" the agent signs
/// transactions with. Owner and agent address can differ and be re-keyed
/// independently, so an identity's history/reputation survives key rotation
/// or transfer of ownership.
/// @dev See https://eips.ethereum.org/EIPS/eip-8004 for the broader
/// Trustless Agents standard (Identity, Reputation and Validation
/// registries). This contract implements a minimal, self-contained Identity
/// Registry compatible with that model.
contract AgentIdentityRegistry is ERC721 {
    uint256 private _nextAgentId = 1;

    mapping(uint256 agentId => string uri) private _agentURIs;
    mapping(uint256 agentId => address wallet) public agentAddress;
    mapping(address wallet => uint256 agentId) public agentIdOf;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        address indexed agentAddress,
        string agentURI
    );
    event AgentURIUpdated(uint256 indexed agentId, string agentURI);
    event AgentAddressUpdated(uint256 indexed agentId, address agentAddress);

    error AgentAddressAlreadyRegistered(address agentAddress, uint256 existingAgentId);
    error NotAgentOwner(uint256 agentId, address caller);

    constructor() ERC721("Mantle Edge Agent Identity", "AGENT") {}

    /// @notice Registers a new agent identity owned by the caller.
    /// @param agentAddress_ The wallet the agent uses to sign on-chain transactions.
    /// @param agentURI_ Off-chain metadata URI (IPFS/HTTPS) describing the agent.
    /// @return agentId The newly minted identity token ID.
    function register(address agentAddress_, string calldata agentURI_) external returns (uint256 agentId) {
        if (agentIdOf[agentAddress_] != 0) {
            revert AgentAddressAlreadyRegistered(agentAddress_, agentIdOf[agentAddress_]);
        }

        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);

        _agentURIs[agentId] = agentURI_;
        agentAddress[agentId] = agentAddress_;
        agentIdOf[agentAddress_] = agentId;

        emit AgentRegistered(agentId, msg.sender, agentAddress_, agentURI_);
    }

    /// @notice Updates the off-chain metadata URI for an agent identity.
    function setAgentURI(uint256 agentId, string calldata agentURI_) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner(agentId, msg.sender);

        _agentURIs[agentId] = agentURI_;
        emit AgentURIUpdated(agentId, agentURI_);
    }

    /// @notice Re-keys the operating wallet address for an agent identity.
    function setAgentAddress(uint256 agentId, address agentAddress_) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner(agentId, msg.sender);
        if (agentIdOf[agentAddress_] != 0) {
            revert AgentAddressAlreadyRegistered(agentAddress_, agentIdOf[agentAddress_]);
        }

        delete agentIdOf[agentAddress[agentId]];
        agentAddress[agentId] = agentAddress_;
        agentIdOf[agentAddress_] = agentId;

        emit AgentAddressUpdated(agentId, agentAddress_);
    }

    /// @notice Returns the off-chain metadata URI for an agent identity.
    function agentURI(uint256 agentId) external view returns (string memory) {
        _requireOwned(agentId);
        return _agentURIs[agentId];
    }

    /// @inheritdoc ERC721
    function tokenURI(uint256 agentId) public view override returns (string memory) {
        _requireOwned(agentId);
        return _agentURIs[agentId];
    }
}
