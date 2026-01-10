export const formatContractName = (contractAddress: string): string => {
  return contractAddress
    .split('.')[1]
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Normalize a Move/Aptos address to a consistent format.
 * Movement/Aptos addresses are 32 bytes (64 hex chars), but may be returned
 * with or without leading zeros. This function ensures consistent comparison.
 * @param address - The address to normalize (with or without 0x prefix)
 * @returns Normalized address in lowercase with 0x prefix and padded to 64 chars
 */
export const normalizeAddress = (address: string): string => {
  if (!address) return '';
  // Remove 0x prefix if present
  const withoutPrefix = address.toLowerCase().replace(/^0x/, '');
  // Pad to 64 characters (32 bytes)
  const padded = withoutPrefix.padStart(64, '0');
  return `0x${padded}`;
};

/**
 * Compare two Move/Aptos addresses for equality.
 * Handles addresses with different formats (with/without leading zeros).
 * @param addr1 - First address
 * @param addr2 - Second address
 * @returns True if addresses are equal, false otherwise
 */
export const addressesEqual = (addr1: string, addr2: string): boolean => {
  return normalizeAddress(addr1) === normalizeAddress(addr2);
};
