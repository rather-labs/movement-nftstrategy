/**
 * Wallet Adapter Configuration for Movement
 * Configures the Aptos wallet adapter for Movement network
 */

import { Network } from '@aptos-labs/ts-sdk';

// Movement network identifier
export const MOVEMENT_NETWORK = 'Movement';

// Chain IDs for Movement networks
export const MOVEMENT_CHAIN_IDS = {
  BARDOCK_TESTNET: 250,
  PORTO_TESTNET: 177,
  MAINNET: 126,
} as const;

// Network configurations
export const NETWORK_MAP: Record<
  number,
  {
    chainId: number;
    name: Network;
    url: string;
    buttonName: string;
  }
> = {
  [MOVEMENT_CHAIN_IDS.BARDOCK_TESTNET]: {
    chainId: 250,
    name: Network.CUSTOM,
    url: 'https://aptos.testnet.bardock.movementlabs.xyz/v1',
    buttonName: 'Bardock Testnet',
  },
  [MOVEMENT_CHAIN_IDS.PORTO_TESTNET]: {
    chainId: 177,
    name: Network.CUSTOM,
    url: 'https://aptos.testnet.porto.movementlabs.xyz/v1',
    buttonName: 'Porto Testnet',
  },
  [MOVEMENT_CHAIN_IDS.MAINNET]: {
    chainId: 126,
    name: Network.CUSTOM,
    url: 'https://mainnet.movementnetwork.xyz/v1',
    buttonName: 'Move Mainnet',
  },
};

// Default network (Bardock Testnet)
export const DEFAULT_CHAIN_ID = MOVEMENT_CHAIN_IDS.BARDOCK_TESTNET;
export const DEFAULT_NETWORK_CONFIG = NETWORK_MAP[DEFAULT_CHAIN_ID];
