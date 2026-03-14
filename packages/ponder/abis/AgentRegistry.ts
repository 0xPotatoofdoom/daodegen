export const AgentRegistryAbi = [
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentAddress", type: "address", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentRevoked",
    inputs: [
      { name: "agentAddress", type: "address", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "AgentUpdated",
    inputs: [
      { name: "agentAddress", type: "address", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "newMetadataURI", type: "string", indexed: false },
    ],
  },
  {
    type: "function",
    name: "isAgent",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentId",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
