/**
 * NFT Collection Operations for Movement
 * Interacts with the nft_collection Move module
 */

import { NFT_FUNCTIONS, TYPE_ARGUMENTS, MODULE_ADDRESS } from '@/constants/contracts';
import { viewFunction } from '@/lib/movement-client';
import { InputTransactionData } from '@/lib/wallet-context';

// ============ Types ============

export interface CollectionInfo {
  creator: string;
  name: string;
  description: string;
  currentSupply: number;
  maxSupply: number;
}

export interface NftInfo {
  collection: string;
  tokenId: number;
}

// ============ Transaction Builders ============

/**
 * Build transaction to create a collection
 */
export function buildCreateCollectionTransaction(description: string): InputTransactionData {
  return {
    data: {
      function: NFT_FUNCTIONS.CREATE_COLLECTION,
      typeArguments: [],
      functionArguments: [description],
    },
  };
}

/**
 * Build transaction to mint an NFT
 */
export function buildMintNftTransaction(recipientAddress: string): InputTransactionData {
  return {
    data: {
      function: NFT_FUNCTIONS.MINT,
      typeArguments: [],
      functionArguments: [recipientAddress],
    },
  };
}

/**
 * Build transaction to mint multiple NFTs
 */
export function buildMintBatchTransaction(
  recipientAddress: string,
  count: number
): InputTransactionData {
  return {
    data: {
      function: NFT_FUNCTIONS.MINT_BATCH,
      typeArguments: [],
      functionArguments: [recipientAddress, count],
    },
  };
}

/**
 * Build transaction to transfer an NFT
 */
export function buildTransferNftTransaction(
  nftAddress: string,
  toAddress: string
): InputTransactionData {
  return {
    data: {
      function: NFT_FUNCTIONS.TRANSFER,
      typeArguments: [],
      functionArguments: [nftAddress, toAddress],
    },
  };
}

/**
 * Build transaction to burn an NFT
 */
export function buildBurnNftTransaction(nftAddress: string): InputTransactionData {
  return {
    data: {
      function: NFT_FUNCTIONS.BURN,
      typeArguments: [],
      functionArguments: [nftAddress],
    },
  };
}

// ============ View Functions ============

/**
 * Get the collection address for a creator
 */
export async function getCollectionAddress(creatorAddress: string): Promise<string> {
  const result = await viewFunction<[string]>(
    NFT_FUNCTIONS.GET_COLLECTION_ADDRESS,
    [],
    [creatorAddress]
  );
  return result[0];
}

/**
 * Get collection information
 */
export async function getCollectionInfo(collectionAddress: string): Promise<CollectionInfo> {
  const result = await viewFunction<[string, string, string, string, string]>(
    NFT_FUNCTIONS.GET_COLLECTION_INFO,
    [],
    [collectionAddress]
  );

  return {
    creator: result[0],
    name: result[1],
    description: result[2],
    currentSupply: Number(result[3]),
    maxSupply: Number(result[4]),
  };
}

/**
 * Get NFT information by address
 */
export async function getNftInfo(nftAddress: string): Promise<NftInfo> {
  const result = await viewFunction<[string, string]>(NFT_FUNCTIONS.GET_NFT_INFO, [], [nftAddress]);

  return {
    collection: result[0],
    tokenId: Number(result[1]),
  };
}

/**
 * Get the token URI for an NFT
 */
export async function fetchTokenUri(nftAddress: string): Promise<string> {
  const result = await viewFunction<[string]>(NFT_FUNCTIONS.TOKEN_URI, [], [nftAddress]);
  return result[0];
}

/**
 * Get the owner of an NFT
 */
export async function getNftOwner(nftAddress: string): Promise<string> {
  const result = await viewFunction<[string]>(NFT_FUNCTIONS.GET_OWNER, [], [nftAddress]);
  return result[0];
}

/**
 * Get NFT address by token ID
 * This is the utility function to map token_id → object address
 */
export async function getNftAddressByTokenId(
  collectionAddress: string,
  tokenId: number
): Promise<string> {
  const result = await viewFunction<[string]>(
    NFT_FUNCTIONS.GET_NFT_BY_TOKEN_ID,
    [],
    [collectionAddress, tokenId]
  );
  return result[0];
}

/**
 * Check if a collection exists for a creator
 */
export async function collectionExists(creatorAddress: string): Promise<boolean> {
  const result = await viewFunction<[boolean]>(
    NFT_FUNCTIONS.COLLECTION_EXISTS,
    [],
    [creatorAddress]
  );
  return result[0];
}

/**
 * Get current supply of a collection
 */
export async function getCurrentSupply(collectionAddress: string): Promise<number> {
  const result = await viewFunction<[string]>(
    NFT_FUNCTIONS.GET_CURRENT_SUPPLY,
    [],
    [collectionAddress]
  );
  return Number(result[0]);
}

/**
 * Get maximum supply constant
 */
export async function getMaxSupply(): Promise<number> {
  const result = await viewFunction<[string]>(NFT_FUNCTIONS.GET_MAX_SUPPLY, [], []);
  return Number(result[0]);
}

/**
 * Check if an NFT exists at a given address
 */
export async function nftExists(nftAddress: string): Promise<boolean> {
  const result = await viewFunction<[boolean]>(NFT_FUNCTIONS.NFT_EXISTS, [], [nftAddress]);
  return result[0];
}

// ============ Helper Functions ============

/**
 * Get all NFTs owned by an address
 * Note: This requires indexer support
 */
export async function getNftsOwnedByAddress(ownerAddress: string): Promise<string[]> {
  // TODO: Implement using Movement indexer
  // For now, this would require tracking via events or external indexing
  console.warn('getNftsOwnedByAddress: Indexer query not yet implemented');
  return [];
}

/**
 * Get the default collection address (using MODULE_ADDRESS as creator)
 */
export async function getDefaultCollectionAddress(): Promise<string> {
  return getCollectionAddress(MODULE_ADDRESS);
}
