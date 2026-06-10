/**
 * Mantle L2 mainnet network configuration.
 * @see https://docs.mantle.xyz
 */
export const MANTLE_MAINNET = {
  chainId: 5000,
  name: "Mantle",
  rpcUrl: "https://rpc.mantle.xyz",
  explorerUrl: "https://mantlescan.xyz",
  nativeCurrency: {
    name: "Mantle",
    symbol: "MNT",
    decimals: 18,
  },
} as const;

/** Mantle Sepolia testnet, useful for dry-running the agent before mainnet. */
export const MANTLE_TESTNET = {
  chainId: 5003,
  name: "Mantle Sepolia Testnet",
  rpcUrl: "https://rpc.sepolia.mantle.xyz",
  explorerUrl: "https://sepolia.mantlescan.xyz",
  nativeCurrency: {
    name: "Mantle",
    symbol: "MNT",
    decimals: 18,
  },
} as const;

export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
}

/** Well-known ERC-20 token addresses on Mantle mainnet. */
export const MANTLE_TOKENS = {
  WMNT: {
    address: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
    symbol: "WMNT",
    decimals: 18,
  },
  USDC: {
    address: "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9",
    symbol: "USDC",
    decimals: 6,
  },
  USDT: {
    address: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
    symbol: "USDT",
    decimals: 6,
  },
} as const satisfies Record<string, TokenInfo>;

/**
 * Merchant Moe — Liquidity Book v2.2 contracts on Mantle mainnet.
 * @see https://docs.merchantmoe.com/resources/contracts
 */
export const MERCHANT_MOE = {
  lbRouter: "0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a",
  lbFactory: "0xa6630671775c4EA2743840F9A5016dCf2A104054",
  lbQuoter: "0x501b8AFd35df20f531fF45F6f695793AC3316c85",
} as const;

/**
 * Agni Finance — Uniswap V3-style concentrated liquidity AMM on Mantle mainnet.
 * @see https://github.com/agni-protocol/agni-sdk
 */
export const AGNI_FINANCE = {
  swapRouter: "0x319B69888b0d11cEC22caA5034e25FfFBDc88421",
  quoterV2: "0xc4aaDc921E1cdb66c5300Bc158a313292923C0cb",
  factory: "0x25780dc8Fc3cfBD75F33bFDAB65e969b603b2035",
} as const;

/** Maps the symbols used in `BASE/QUOTE` trading pairs to their on-chain token info. */
export const TOKENS_BY_SYMBOL: Record<string, TokenInfo> = {
  MNT: MANTLE_TOKENS.WMNT,
  WMNT: MANTLE_TOKENS.WMNT,
  USDC: MANTLE_TOKENS.USDC,
  USDT: MANTLE_TOKENS.USDT,
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Decision/trade venues supported by the agent. */
export const EXECUTION_VENUES = ["dex", "cex"] as const;

/** Trading actions a strategy can decide on. */
export const TRADE_ACTIONS = ["BUY", "SELL", "HOLD"] as const;

/** DEXes the agent can route swaps through on Mantle. */
export const DEX_NAMES = ["merchant_moe", "agni_finance"] as const;
