// Movement Network Types
export type Network = 'testnet' | 'mainnet';

// Network configuration
export const NETWORK_CONFIG = {
  testnet: {
    chainId: 250,
    name: 'Movement Testnet',
    fullnode: 'https://testnet.movementnetwork.xyz/v1',
    explorerNetwork: 'testnet',
  },
  mainnet: {
    chainId: 126,
    name: 'Movement Mainnet',
    fullnode: 'https://mainnet.movementnetwork.xyz/v1',
    explorerNetwork: 'mainnet',
  },
} as const;

// Default network
export const DEFAULT_NETWORK: Network = 'testnet';

/**
 * Get network from chain ID
 */
export function getNetworkFromChainId(chainId: number | undefined): Network {
  if (chainId === 126) return 'mainnet';
  return 'testnet'; // Default to testnet
}

/**
 * Get chain ID from network
 */
export function getChainId(network: Network): number {
  return NETWORK_CONFIG[network].chainId;
}

/**
 * Get fullnode URL for network
 */
export function getFullnodeUrl(network: Network): string {
  return NETWORK_CONFIG[network].fullnode;
}
