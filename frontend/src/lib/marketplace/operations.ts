/**
 * Marketplace Operations for Movement
 * Interacts with the marketplace Move module
 */

import { MARKETPLACE_FUNCTIONS, TYPE_ARGUMENTS } from '@/constants/contracts';
import { viewFunction, getAptosClient, waitForTransaction } from '@/lib/movement-client';
import { InputTransactionData } from '@/lib/wallet-context';

// ============ Types ============

export interface Listing {
  nftAddress: string;
  seller: string;
  price: number; // in MOVE (8 decimals)
}

export interface MarketplaceInfo {
  feeBps: number;
  feeRecipient: string;
  admin: string;
  totalSales: number;
}

// ============ Transaction Builders ============

/**
 * Build transaction to list an NFT for sale
 */
export function buildListNftTransaction(nftAddress: string, price: number): InputTransactionData {
  return {
    data: {
      function: MARKETPLACE_FUNCTIONS.LIST_NFT,
      typeArguments: [TYPE_ARGUMENTS.NFT],
      functionArguments: [nftAddress, price],
    },
  };
}

/**
 * Build transaction to cancel a listing
 */
export function buildCancelListingTransaction(nftAddress: string): InputTransactionData {
  return {
    data: {
      function: MARKETPLACE_FUNCTIONS.CANCEL_LISTING,
      typeArguments: [TYPE_ARGUMENTS.NFT],
      functionArguments: [nftAddress],
    },
  };
}

/**
 * Build transaction to update listing price
 */
export function buildUpdatePriceTransaction(
  nftAddress: string,
  newPrice: number
): InputTransactionData {
  return {
    data: {
      function: MARKETPLACE_FUNCTIONS.UPDATE_PRICE,
      typeArguments: [TYPE_ARGUMENTS.NFT],
      functionArguments: [nftAddress, newPrice],
    },
  };
}

/**
 * Build transaction to buy an NFT
 */
export function buildBuyNftTransaction(nftAddress: string): InputTransactionData {
  return {
    data: {
      function: MARKETPLACE_FUNCTIONS.BUY_NFT,
      typeArguments: [TYPE_ARGUMENTS.NFT],
      functionArguments: [nftAddress],
    },
  };
}

/**
 * Build transaction to initialize the marketplace
 * @param feeBps - Fee in basis points (e.g., 100 = 1%)
 * @param feeRecipient - Address to receive marketplace fees
 */
export function buildInitializeMarketplaceTransaction(
  feeBps: number,
  feeRecipient: string
): InputTransactionData {
  return {
    data: {
      function: MARKETPLACE_FUNCTIONS.INITIALIZE,
      typeArguments: [],
      functionArguments: [feeBps, feeRecipient],
    },
  };
}

/**
 * Build transaction to set marketplace fee
 * @param newFeeBps - New fee in basis points (max 1000 = 10%)
 */
export function buildSetFeeBpsTransaction(newFeeBps: number): InputTransactionData {
  return {
    data: {
      function: MARKETPLACE_FUNCTIONS.SET_FEE_BPS,
      typeArguments: [],
      functionArguments: [newFeeBps],
    },
  };
}

/**
 * Build transaction to set fee recipient
 * @param newRecipient - New fee recipient address
 */
export function buildSetFeeRecipientTransaction(newRecipient: string): InputTransactionData {
  return {
    data: {
      function: MARKETPLACE_FUNCTIONS.SET_FEE_RECIPIENT,
      typeArguments: [],
      functionArguments: [newRecipient],
    },
  };
}

/**
 * Build transaction to transfer marketplace admin role
 * @param newAdmin - New admin address
 */
export function buildSetMarketplaceAdminTransaction(newAdmin: string): InputTransactionData {
  return {
    data: {
      function: MARKETPLACE_FUNCTIONS.SET_ADMIN,
      typeArguments: [],
      functionArguments: [newAdmin],
    },
  };
}

// ============ View Functions ============

/**
 * Get listing information for an NFT
 * Returns [seller, price] or throws if not listed
 */
export async function fetchListing(nftAddress: string): Promise<Listing | undefined> {
  try {
    const result = await viewFunction<[string, string]>(
      MARKETPLACE_FUNCTIONS.GET_LISTING,
      [],
      [nftAddress]
    );

    return {
      nftAddress,
      seller: result[0],
      price: Number(result[1]),
    };
  } catch (error) {
    // Listing doesn't exist
    console.error('Error fetching listing:', error);
    return undefined;
  }
}

/**
 * Check if an NFT is listed
 */
export async function isNftListed(nftAddress: string): Promise<boolean> {
  try {
    const result = await viewFunction<[boolean]>(MARKETPLACE_FUNCTIONS.IS_LISTED, [], [nftAddress]);
    return result[0];
  } catch (error) {
    console.error('Error checking if NFT is listed:', error);
    return false;
  }
}

/**
 * Get marketplace configuration
 * Returns [fee_bps, fee_recipient, admin, total_sales]
 */
export async function fetchMarketplaceInfo(): Promise<MarketplaceInfo | undefined> {
  try {
    const result = await viewFunction<[string, string, string, string]>(
      MARKETPLACE_FUNCTIONS.GET_MARKETPLACE_INFO,
      [],
      []
    );

    return {
      feeBps: Number(result[0]),
      feeRecipient: result[1],
      admin: result[2],
      totalSales: Number(result[3]),
    };
  } catch (error) {
    console.error('Error fetching marketplace info:', error);
    return undefined;
  }
}

/**
 * Calculate fee for a given price
 */
export async function calculateFee(price: number): Promise<number> {
  try {
    const result = await viewFunction<[string]>(MARKETPLACE_FUNCTIONS.CALCULATE_FEE, [], [price]);
    return Number(result[0]);
  } catch (error) {
    console.error('Error calculating fee:', error);
    return 0;
  }
}

/**
 * Check if marketplace is initialized
 */
export async function isMarketplaceInitialized(): Promise<boolean> {
  try {
    const result = await viewFunction<[boolean]>(MARKETPLACE_FUNCTIONS.IS_INITIALIZED, [], []);
    return result[0];
  } catch (error) {
    console.error('Error checking marketplace initialization:', error);
    return false;
  }
}

// ============ Query Helpers ============

/**
 * Fetch all active listings by querying events
 * Note: This requires indexer support. For now, we use a simpler approach.
 */
export async function fetchAllListings(): Promise<Listing[]> {
  // TODO: Implement event-based listing query using Movement indexer
  // For now, this would require tracking NFT addresses that have been listed
  console.warn('fetchAllListings: Event-based query not yet implemented');
  return [];
}
