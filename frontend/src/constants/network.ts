/**
 * Movement Network Configuration
 * Single source of truth for network settings
 */

export const MOVEMENT_TESTNET = {
  chainId: 250,
  name: 'Movement Testnet',
  rpc: 'https://testnet.movementnetwork.xyz/v1',
  indexer: 'https://indexer.testnet.movementnetwork.xyz/v1/graphql',
  explorer: 'https://explorer.movementnetwork.xyz',
} as const;

export const MOVEMENT_MAINNET = {
  chainId: 126,
  name: 'Movement Mainnet',
  rpc: 'https://mainnet.movementnetwork.xyz/v1',
  indexer: 'https://indexer.mainnet.movementnetwork.xyz/v1/graphql',
  explorer: 'https://explorer.movementnetwork.xyz',
} as const;

// Default network for the app
export const DEFAULT_NETWORK = MOVEMENT_TESTNET;

// Legacy exports for backwards compatibility
export const MOVEMENT_TESTNET_CHAIN_ID = MOVEMENT_TESTNET.chainId;
export const MOVEMENT_TESTNET_RPC = MOVEMENT_TESTNET.rpc;
export const MOVEMENT_TESTNET_INDEXER = MOVEMENT_TESTNET.indexer;

export const MOVEMENT_TESTNET_NETWORK_INFO = {
  chainId: MOVEMENT_TESTNET.chainId,
  name: 'testnet' as const,
  url: MOVEMENT_TESTNET.rpc,
};
