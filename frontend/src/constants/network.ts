export const MOVEMENT_TESTNET_CHAIN_ID = 250;
export const MOVEMENT_TESTNET_RPC = 'https://testnet.movementnetwork.xyz/v1';
export const MOVEMENT_TESTNET_INDEXER = 'https://indexer.testnet.movementnetwork.xyz/v1/graphql';

export const MOVEMENT_TESTNET_NETWORK_INFO = {
  chainId: MOVEMENT_TESTNET_CHAIN_ID,
  name: 'testnet' as const,
  url: MOVEMENT_TESTNET_RPC,
};
