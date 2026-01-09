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
  STRATEGY_FUNCTIONS,
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
 * Build transaction to initialize the strategy module
 * Creates a treasury object with deterministic address based on admin address
 */
export function buildInitializeStrategyTransaction(): InputTransactionData {
  return {
    data: {
      function: STRATEGY_FUNCTIONS.INITIALIZE,
      typeArguments: [],
      functionArguments: [],
    },
  };
}

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
    const result = await viewFunction<[string]>(RATHER_TOKEN_FUNCTIONS.BALANCE_OF, [], [address]);
    return Number(result[0]);
  } catch (error) {
    console.error('Error fetching RatherToken balance:', error);
    return 0;
  }
}

/**
 * Get WMOVE balance for an address
 */
export async function fetchWmoveBalance(address: string): Promise<number> {
  try {
    const result = await viewFunction<[string]>(WMOVE_FUNCTIONS.BALANCE_OF, [], [address]);
    return Number(result[0]);
  } catch (error) {
    console.error('Error fetching WMOVE balance:', error);
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
 * Get RATHER token stats (total minted, total burned, current supply)
 */
export interface RatherTokenStats {
  totalMinted: number;
  totalBurned: number;
  currentSupply: number;
}

export async function fetchRatherTokenStats(): Promise<RatherTokenStats> {
  try {
    const [totalMintedResult, totalBurnedResult, currentSupplyResult] = await Promise.all([
      viewFunction<[string]>(RATHER_TOKEN_FUNCTIONS.GET_TOTAL_MINTED, [], []),
      viewFunction<[string]>(RATHER_TOKEN_FUNCTIONS.GET_TOTAL_BURNED, [], []),
      viewFunction<[string]>(RATHER_TOKEN_FUNCTIONS.GET_CURRENT_SUPPLY, [], []),
    ]);

    return {
      totalMinted: Number(totalMintedResult[0]),
      totalBurned: Number(totalBurnedResult[0]),
      currentSupply: Number(currentSupplyResult[0]),
    };
  } catch (error) {
    console.error('Error fetching RATHER token stats:', error);
    return {
      totalMinted: 0,
      totalBurned: 0,
      currentSupply: 0,
    };
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

// ============ Strategy Contract Functions ============

/**
 * Strategy info from the contract
 */
export interface StrategyInfo {
  treasuryAddress: string;
  totalFloorBuys: number;
  totalWmoveSpent: number;
}

/**
 * Build transaction to execute the buy floor and relist strategy
 * This can be called by any user but operates on treasury funds
 * @param nftAddress - Address of the floor NFT to buy
 */
export function buildBuyFloorAndRelistTransaction(nftAddress: string): InputTransactionData {
  return {
    data: {
      function: STRATEGY_FUNCTIONS.BUY_FLOOR_AND_RELIST,
      typeArguments: [TYPE_ARGUMENTS.NFT],
      functionArguments: [nftAddress],
    },
  };
}

/**
 * Build transaction to deposit WMOVE into the strategy treasury
 * @param amount - Amount in octas (8 decimals)
 */
export function buildDepositWmoveTransaction(amount: number): InputTransactionData {
  return {
    data: {
      function: STRATEGY_FUNCTIONS.DEPOSIT_WMOVE,
      typeArguments: [],
      functionArguments: [amount],
    },
  };
}

/**
 * Build transaction to wrap MOVE and deposit into the strategy treasury
 * @param amount - Amount in octas (8 decimals)
 */
export function buildWrapAndDepositTransaction(amount: number): InputTransactionData {
  return {
    data: {
      function: STRATEGY_FUNCTIONS.WRAP_AND_DEPOSIT,
      typeArguments: [],
      functionArguments: [amount],
    },
  };
}

/**
 * Fetch strategy contract info
 */
export async function fetchStrategyInfo(): Promise<StrategyInfo | null> {
  try {
    const result = await viewFunction<[string, string, string]>(
      STRATEGY_FUNCTIONS.GET_STRATEGY_INFO,
      [],
      []
    );

    return {
      treasuryAddress: result[0],
      totalFloorBuys: Number(result[1]),
      totalWmoveSpent: Number(result[2]),
    };
  } catch (error) {
    console.error('Error fetching strategy info:', error);
    return null;
  }
}

/**
 * Fetch the treasury address from the strategy contract
 */
export async function fetchStrategyTreasuryAddress(): Promise<string | null> {
  try {
    const result = await viewFunction<[string]>(STRATEGY_FUNCTIONS.GET_TREASURY_ADDRESS, [], []);
    return result[0];
  } catch (error) {
    console.error('Error fetching strategy treasury address:', error);
    return null;
  }
}

/**
 * Fetch the treasury WMOVE balance from the strategy contract
 */
export async function fetchStrategyTreasuryWmoveBalance(): Promise<number> {
  try {
    const result = await viewFunction<[string]>(
      STRATEGY_FUNCTIONS.GET_TREASURY_WMOVE_BALANCE,
      [],
      []
    );
    return Number(result[0]);
  } catch (error) {
    console.error('Error fetching strategy treasury WMOVE balance:', error);
    return 0;
  }
}

/**
 * Check if the strategy contract is initialized
 */
export async function isStrategyInitialized(): Promise<boolean> {
  try {
    const result = await viewFunction<[boolean]>(STRATEGY_FUNCTIONS.IS_INITIALIZED, [], []);
    return result[0];
  } catch (error) {
    console.error('Error checking strategy initialization:', error);
    return false;
  }
}

/**
 * Preview the treasury address before initialization
 * This returns the deterministic address based on admin address and "TREASURY" seed
 */
export async function fetchTreasuryAddressPreview(adminAddress: string): Promise<string | null> {
  try {
    const result = await viewFunction<[string]>(
      STRATEGY_FUNCTIONS.GET_TREASURY_ADDRESS_PREVIEW,
      [],
      [adminAddress]
    );
    return result[0];
  } catch (error) {
    console.error('Error fetching treasury address preview:', error);
    return null;
  }
}
