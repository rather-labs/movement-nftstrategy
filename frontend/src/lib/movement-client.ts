import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

// Movement Network Configuration
export const MOVEMENT_CONFIG = {
  testnet: {
    chainId: 250,
    name: 'Movement Testnet',
    fullnode: 'https://testnet.movementnetwork.xyz/v1',
    explorer: 'testnet',
  },
  mainnet: {
    chainId: 126,
    name: 'Movement Mainnet',
    fullnode: 'https://mainnet.movementnetwork.xyz/v1',
    explorer: 'mainnet',
  },
} as const;

// Default to testnet
export const DEFAULT_NETWORK = 'testnet' as const;

// Singleton Aptos client
let aptosClient: Aptos | null = null;

/**
 * Get the Aptos client for Movement network
 * Uses testnet by default
 */
export function getAptosClient(network: 'testnet' | 'mainnet' = DEFAULT_NETWORK): Aptos {
  const config = MOVEMENT_CONFIG[network];

  // Create new client if not exists or network changed
  if (!aptosClient) {
    const aptosConfig = new AptosConfig({
      network: Network.CUSTOM,
      fullnode: config.fullnode,
    });
    aptosClient = new Aptos(aptosConfig);
  }

  return aptosClient;
}

/**
 * Get explorer URL for a transaction
 */
export function getTransactionExplorerUrl(
  txHash: string,
  network: 'testnet' | 'mainnet' = DEFAULT_NETWORK
): string {
  const config = MOVEMENT_CONFIG[network];
  return `https://explorer.movementnetwork.xyz/txn/${txHash}?network=${config.explorer}`;
}

/**
 * Get explorer URL for an account
 */
export function getAccountExplorerUrl(
  address: string,
  network: 'testnet' | 'mainnet' = DEFAULT_NETWORK
): string {
  const config = MOVEMENT_CONFIG[network];
  return `https://explorer.movementnetwork.xyz/account/${address}?network=${config.explorer}`;
}

/**
 * Wait for a transaction to be confirmed
 */
export async function waitForTransaction(
  txHash: string,
  network: 'testnet' | 'mainnet' = DEFAULT_NETWORK
): Promise<void> {
  const client = getAptosClient(network);
  await client.waitForTransaction({ transactionHash: txHash });
}

/**
 * Call a view function on the blockchain
 */
export async function viewFunction<T>(
  functionId: `${string}::${string}::${string}`,
  typeArguments: string[] = [],
  functionArguments: (string | number | boolean | bigint)[] = [],
  network: 'testnet' | 'mainnet' = DEFAULT_NETWORK
): Promise<T> {
  const client = getAptosClient(network);

  const result = await client.view({
    payload: {
      function: functionId,
      typeArguments,
      functionArguments,
    },
  });

  return result as T;
}

/**
 * Get native MOVE balance for an address
 * Returns balance in octas (smallest unit)
 */
export async function fetchNativeMoveBalance(
  address: string,
  network: 'testnet' | 'mainnet' = DEFAULT_NETWORK
): Promise<number> {
  try {
    const client = getAptosClient(network);
    const balance = await client.getAccountAPTAmount({ accountAddress: address });
    return balance;
  } catch (error) {
    console.error('Error fetching native MOVE balance:', error);
    return 0;
  }
}
