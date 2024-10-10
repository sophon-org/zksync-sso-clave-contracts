export const FactoryAbi = [
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "_proxyAaBytecodeHash",
        type: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    name: "accountMappings",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "uniqueAccountId",
        type: "bytes32",
      },
    ],
    name: "addNewUniqueId",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "accountImplementionLocation",
        type: "address",
      },
      {
        internalType: "string",
        name: "uniqueAccountId",
        type: "string",
      },
      {
        internalType: "bytes[]",
        name: "initialValidators",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "initialModules",
        type: "bytes[]",
      },
      {
        internalType: "address[]",
        name: "initialK1Owners",
        type: "address[]",
      },
    ],
    name: "deployProxy7579Account",
    outputs: [
      {
        internalType: "address",
        name: "accountAddress",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "proxyAaBytecodeHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
