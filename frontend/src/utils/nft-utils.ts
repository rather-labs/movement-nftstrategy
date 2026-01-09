import { MODULE_ADDRESS } from '@/constants/contracts';

/**
 * Get a placeholder image for an NFT based on its token ID
 * Used when actual token URI is not available
 */
export const getPlaceholderImage = (collectionAddress: string, tokenId: number): string | null => {
  // Check if this is from our NFT collection
  if (MODULE_ADDRESS && collectionAddress.startsWith(MODULE_ADDRESS)) {
    return `/images/dogs/${tokenId % 12}.webp`;
  }
  return null;
};

/**
 * Format an NFT address for display
 */
export const formatNftAddress = (address: string): string => {
  if (!address) return '';
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
};

/**
 * Check if an address is a valid Move address
 */
export const isValidMoveAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{1,64}$/.test(address);
};
