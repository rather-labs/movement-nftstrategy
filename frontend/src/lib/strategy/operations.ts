/**
 * Strategy Operations for Movement
 * Interacts with the strategy-related Move modules
 */

import {
  RATHER_TOKEN_FUNCTIONS,
  LP_TOKEN_FUNCTIONS,
  TYPE_ARGUMENTS,
  MARKETPLACE_FUNCTIONS,
  NFT_FUNCTIONS,
  WMOVE_FUNCTIONS,
  TREASURY_ADDRESS,
} from '@/constants/contracts';
import { viewFunction } from '@/lib/movement-client';
import { InputTransactionData } from '@/lib/wallet-context';
import { fetchPoolReserves, fetchPoolFeeInfo } from '@/lib/pool/operations';
import { fetchMarketplaceInfo, fetchListing, Listing } from '@/lib/marketplace/operations';

// ============ Types ============

export interface StrategyMetrics {
  poolReserveRather: number;
  poolReserveWmove: number;
  floorListing: Listing | null;
}

// ============ Transaction Builders ============

/**
 * Build transaction to mint RatherToken (admin only)
 */
export function buildMintRatherTokenTransaction(
  toAddress: string,
  amount: number
): InputTransactionData {
  return {
    data: {
      function: RATHER_TOKEN_FUNCTIONS.MINT_ENTRY,
      typeArguments: [],
      functionArguments: [toAddress, amount],
    },
  };
}

/**
 * Build transaction to burn RatherToken (admin only)
 */
export function buildBurnRatherTokenTransaction(
  fromAddress: string,
  amount: number
): InputTransactionData {
  return {
    data: {
      function: RATHER_TOKEN_FUNCTIONS.BURN_ENTRY,
      typeArguments: [],
      functionArguments: [fromAddress, amount],
    },
  };
}

// ============ View Functions ============

/**
 * Get WMOVE balance for the treasury address
 */
export async function fetchTreasuryWmoveBalance(): Promise<number> {
  try {
    const result = await viewFunction<[string]>(WMOVE_FUNCTIONS.BALANCE_OF, [], [TREASURY_ADDRESS]);
    return Number(result[0]);
  } catch (error) {
    console.error('Error fetching treasury WMOVE balance:', error);
    return 0;
  }
}

/**
 * Get RATHER token balance for the treasury address (burnable balance)
 */
export async function fetchTreasuryRatherBalance(): Promise<number> {
  try {
    const result = await viewFunction<[string]>(
      RATHER_TOKEN_FUNCTIONS.BALANCE_OF,
      [],
      [TREASURY_ADDRESS]
    );
    return Number(result[0]);
  } catch (error) {
    console.error('Error fetching treasury RATHER balance:', error);
    return 0;
  }
}

/**
 * Get RatherToken balance for an address
 */
export async function fetchRatherTokenBalance(address: string): Promise<number> {
  try {
    const result = await viewFunction<[string]>(RATHER_TOKEN_FUNCTIONS.GET_BALANCE, [], [address]);
    return Number(result[0]);
  } catch (error) {
    console.error('Error fetching RatherToken balance:', error);
    return 0;
  }
}

/**
 * Get LP token balance for an address
 */
export async function fetchLpTokenBalance(address: string): Promise<number> {
  try {
    const result = await viewFunction<[string]>(
      LP_TOKEN_FUNCTIONS.GET_BALANCE,
      [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      [address]
    );
    return Number(result[0]);
  } catch (error) {
    console.error('Error fetching LP token balance:', error);
    return 0;
  }
}

/**
 * Get total LP token supply
 */
export async function fetchLpTokenSupply(): Promise<number> {
  try {
    const result = await viewFunction<[string]>(
      LP_TOKEN_FUNCTIONS.GET_SUPPLY,
      [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      []
    );
    return Number(result[0]);
  } catch (error) {
    console.error('Error fetching LP token supply:', error);
    return 0;
  }
}

/**
 * Fetch strategy metrics from on-chain data
 */
export async function fetchStrategyMetrics(): Promise<StrategyMetrics> {
  try {
    const reserves = await fetchPoolReserves();

    // TODO: Implement floor listing detection via indexer
    // For now, we return null for floor listing
    const floorListing: Listing | null = null;

    return {
      poolReserveRather: reserves.reserveX,
      poolReserveWmove: reserves.reserveY,
      floorListing,
    };
  } catch (error) {
    console.error('Error fetching strategy metrics:', error);
    return {
      poolReserveRather: 0,
      poolReserveWmove: 0,
      floorListing: null,
    };
  }
}

// ============ Helper Functions ============

/**
 * Calculate the value of LP tokens in terms of underlying assets
 */
export async function calculateLpTokenValue(
  lpAmount: number
): Promise<{ ratherAmount: number; wmoveAmount: number }> {
  const reserves = await fetchPoolReserves();
  const totalSupply = await fetchLpTokenSupply();

  if (totalSupply === 0) {
    return { ratherAmount: 0, wmoveAmount: 0 };
  }

  const ratherAmount = Math.floor((lpAmount * reserves.reserveX) / totalSupply);
  const wmoveAmount = Math.floor((lpAmount * reserves.reserveY) / totalSupply);

  return { ratherAmount, wmoveAmount };
}
