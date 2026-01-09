/**
 * Pool Operations for Movement
 * Interacts with the pool Move module (Uniswap V2-style AMM)
 */

import { POOL_FUNCTIONS, TYPE_ARGUMENTS, WMOVE_FUNCTIONS } from '@/constants/contracts';
import { viewFunction } from '@/lib/movement-client';
import { InputTransactionData } from '@/lib/wallet-context';

// ============ Types ============

export interface PoolReserves {
  reserveX: number;
  reserveY: number;
  lastBlockTimestamp: number;
}

export interface PoolFeeInfo {
  feeRecipient: string;
  feeBps: number;
}

// Token decimals (MOVE/WMOVE and RatherToken use 8 decimals)
const DECIMALS = 8;
const DECIMAL_MULTIPLIER = 10 ** DECIMALS;

// ============ Transaction Builders ============

/**
 * Build transaction to create a new pool with RatherToken as X and WMOVE as Y
 * @param admin - Admin address for the pool
 * @param feeRecipient - Address to receive protocol fees
 * @param feeBps - Fee in basis points (e.g., 30 = 0.3%)
 * @param feeToken - 0 = collect fee in X (RatherToken), 1 = collect fee in Y (WMOVE)
 */
export function buildCreatePoolTransaction(
  admin: string,
  feeRecipient: string,
  feeBps: number,
  feeToken: number
): InputTransactionData {
  return {
    data: {
      function: POOL_FUNCTIONS.CREATE_POOL_ENTRY,
      typeArguments: [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      functionArguments: [admin, feeRecipient, feeBps, feeToken],
    },
  };
}

/**
 * Build transaction to wrap MOVE to WMOVE
 * Amount in MOVE (will be converted to octas internally)
 */
export function buildWrapMoveTransaction(amount: number): InputTransactionData {
  return {
    data: {
      function: WMOVE_FUNCTIONS.WRAP,
      typeArguments: [],
      functionArguments: [amount],
    },
  };
}

/**
 * Build transaction to unwrap WMOVE to MOVE
 * Amount in octas (8 decimals)
 */
export function buildUnwrapMoveTransaction(amount: number): InputTransactionData {
  return {
    data: {
      function: WMOVE_FUNCTIONS.UNWRAP,
      typeArguments: [],
      functionArguments: [amount],
    },
  };
}

/**
 * Build transaction to add liquidity
 * Amounts in smallest units (8 decimals)
 */
export function buildAddLiquidityTransaction(
  amountX: number,
  amountY: number
): InputTransactionData {
  return {
    data: {
      function: POOL_FUNCTIONS.ADD_LIQUIDITY_ENTRY,
      typeArguments: [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      functionArguments: [amountX, amountY],
    },
  };
}

/**
 * Build transaction to remove liquidity
 * LP amount in smallest units (8 decimals)
 */
export function buildRemoveLiquidityTransaction(lpAmount: number): InputTransactionData {
  return {
    data: {
      function: POOL_FUNCTIONS.REMOVE_LIQUIDITY_ENTRY,
      typeArguments: [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      functionArguments: [lpAmount],
    },
  };
}

/**
 * Build transaction to swap RatherToken for WMOVE
 * Amounts in smallest units (8 decimals)
 */
export function buildSwapRatherToWmoveTransaction(
  amountIn: number,
  minAmountOut: number
): InputTransactionData {
  return {
    data: {
      function: POOL_FUNCTIONS.SWAP_X_TO_Y_ENTRY,
      typeArguments: [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      functionArguments: [amountIn, minAmountOut],
    },
  };
}

/**
 * Build transaction to swap WMOVE for RatherToken
 * Amounts in smallest units (8 decimals)
 */
export function buildSwapWmoveToRatherTransaction(
  amountIn: number,
  minAmountOut: number
): InputTransactionData {
  return {
    data: {
      function: POOL_FUNCTIONS.SWAP_Y_TO_X_ENTRY,
      typeArguments: [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      functionArguments: [amountIn, minAmountOut],
    },
  };
}

// ============ View Functions ============

/**
 * Get pool reserves
 * Returns [reserve_x, reserve_y, last_block_timestamp]
 */
export async function fetchPoolReserves(): Promise<PoolReserves> {
  try {
    const result = await viewFunction<[string, string, string]>(
      POOL_FUNCTIONS.GET_RESERVES,
      [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      []
    );

    return {
      reserveX: Number(result[0]),
      reserveY: Number(result[1]),
      lastBlockTimestamp: Number(result[2]),
    };
  } catch (error) {
    console.error('Error fetching pool reserves:', error);
    return { reserveX: 0, reserveY: 0, lastBlockTimestamp: 0 };
  }
}

/**
 * Get pool fee information
 * Returns [fee_recipient, fee_bps]
 */
export async function fetchPoolFeeInfo(): Promise<PoolFeeInfo> {
  try {
    const result = await viewFunction<[string, string]>(
      POOL_FUNCTIONS.GET_FEE_INFO,
      [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      []
    );

    return {
      feeRecipient: result[0],
      feeBps: Number(result[1]),
    };
  } catch (error) {
    console.error('Error fetching pool fee info:', error);
    return { feeRecipient: '', feeBps: 0 };
  }
}

/**
 * Check if pool exists
 */
export async function poolExists(): Promise<boolean> {
  try {
    const result = await viewFunction<[boolean]>(
      POOL_FUNCTIONS.EXISTS_POOL,
      [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      []
    );
    return result[0];
  } catch (error) {
    console.error('Error checking pool existence:', error);
    return false;
  }
}

/**
 * Get WMOVE reserve amount
 */
export async function fetchWmoveReserve(): Promise<number> {
  try {
    const result = await viewFunction<[string]>(WMOVE_FUNCTIONS.GET_RESERVE, [], []);
    return Number(result[0]);
  } catch (error) {
    console.error('Error fetching WMOVE reserve:', error);
    return 0;
  }
}

/**
 * Get WMOVE total supply
 */
export async function fetchWmoveTotalSupply(): Promise<number> {
  try {
    const result = await viewFunction<[string]>(WMOVE_FUNCTIONS.GET_TOTAL_SUPPLY, [], []);
    return Number(result[0]);
  } catch (error) {
    console.error('Error fetching WMOVE total supply:', error);
    return 0;
  }
}

// ============ Helper Functions ============

/**
 * Calculate output amount for a swap using constant product formula
 * amountIn, reserveIn, reserveOut should all be in same units
 * Returns output amount after 0.3% fee
 */
export function calculateSwapOutput(
  amountIn: number,
  reserveIn: number,
  reserveOut: number
): number {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) return 0;

  // Apply 0.3% fee (997/1000)
  const amountInWithFee = amountIn * 997;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000 + amountInWithFee;

  return Math.floor(numerator / denominator);
}

/**
 * Calculate quote for swapping RatherToken → WMOVE using on-chain quote function
 * Returns the net output amount after all fees (protocol + LP)
 */
export async function quoteRatherToWmove(amountIn: number): Promise<number> {
  try {
    // quote_swap_x_to_y returns: (net_amount_out, protocol_fee, fee_token, lp_fee)
    const result = await viewFunction<[string, string, string, string]>(
      POOL_FUNCTIONS.QUOTE_SWAP_X_TO_Y,
      [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      [amountIn]
    );
    return Number(result[0]);
  } catch (error) {
    console.error('Error quoting RatherToken to WMOVE swap:', error);
    return 0;
  }
}

/**
 * Calculate quote for swapping WMOVE → RatherToken using on-chain quote function
 * Returns the net output amount after all fees (protocol + LP)
 */
export async function quoteWmoveToRather(amountIn: number): Promise<number> {
  try {
    // quote_swap_y_to_x returns: (net_amount_out, protocol_fee, fee_token, lp_fee)
    const result = await viewFunction<[string, string, string, string]>(
      POOL_FUNCTIONS.QUOTE_SWAP_Y_TO_X,
      [TYPE_ARGUMENTS.RATHER_TOKEN, TYPE_ARGUMENTS.WMOVE],
      [amountIn]
    );
    return Number(result[0]);
  } catch (error) {
    console.error('Error quoting WMOVE to RatherToken swap:', error);
    return 0;
  }
}

/**
 * Convert human-readable amount to on-chain units
 */
export function toOnChainAmount(humanAmount: number): number {
  return Math.floor(humanAmount * DECIMAL_MULTIPLIER);
}

/**
 * Convert on-chain units to human-readable amount
 */
export function fromOnChainAmount(onChainAmount: number): number {
  return onChainAmount / DECIMAL_MULTIPLIER;
}
