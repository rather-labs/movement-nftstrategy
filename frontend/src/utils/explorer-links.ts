import { Network, DEFAULT_NETWORK } from '@/lib/network';

const EXPLORER_BASE_URL = 'https://explorer.movementnetwork.xyz';

/**
 * Get the explorer network parameter
 */
const getExplorerNetwork = (network: Network | null): string => {
  return network === 'mainnet' ? 'mainnet' : 'testnet';
};

/**
 * Get explorer link for a transaction
 */
export const getExplorerLink = (
  txHash: string,
  network: Network | null = DEFAULT_NETWORK
): string => {
  const explorerNetwork = getExplorerNetwork(network);
  return `${EXPLORER_BASE_URL}/txn/${txHash}?network=${explorerNetwork}`;
};

/**
 * Get explorer link for an account/address
 */
export const getAccountExplorerLink = (
  address: string,
  network: Network | null = DEFAULT_NETWORK
): string => {
  const explorerNetwork = getExplorerNetwork(network);
  return `${EXPLORER_BASE_URL}/account/${address}?network=${explorerNetwork}`;
};

/**
 * Get explorer link for an object (NFT, etc.)
 */
export const getObjectExplorerLink = (
  objectAddress: string,
  network: Network | null = DEFAULT_NETWORK
): string => {
  const explorerNetwork = getExplorerNetwork(network);
  return `${EXPLORER_BASE_URL}/object/${objectAddress}?network=${explorerNetwork}`;
};

/**
 * Alias for getExplorerLink for backward compatibility
 */
export const getTransactionExplorerUrl = getExplorerLink;
