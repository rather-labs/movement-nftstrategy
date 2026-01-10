import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { useWallet } from '@/lib/wallet-context';
import { getAptosClient } from '@/lib/movement-client';
import {
  MODULE_ADDRESS,
  NFT_FUNCTIONS,
  MARKETPLACE_FUNCTIONS,
  STRATEGY_FUNCTIONS,
} from '@/constants/contracts';
import { addressesEqual } from '@/utils/formatting';

// NFT holding information
export interface NftHolding {
  nftAddress: string;
  tokenId: number;
  collectionAddress: string;
}

// Response type for NFT holdings query
export interface NftHoldingsResult {
  items: NftHolding[];
  total: number;
}

/**
 * Hook to fetch NFT holdings for the connected wallet
 * Iterates through all minted NFTs and checks ownership
 */
export const useNftHoldings = (address?: string): UseQueryResult<NftHoldingsResult> => {
  const { network } = useWallet();

  return useQuery<NftHoldingsResult>({
    queryKey: ['nftHoldings', address, network?.chainId],
    queryFn: async () => {
      if (!address) throw new Error('Address is required');

      const client = getAptosClient();

      try {
        // First, get the collection address
        const collectionAddrResult = await client.view({
          payload: {
            function: NFT_FUNCTIONS.GET_COLLECTION_ADDRESS as `${string}::${string}::${string}`,
            typeArguments: [],
            functionArguments: [MODULE_ADDRESS],
          },
        });

        const collectionAddress = collectionAddrResult[0] as string;

        // Get current supply to know how many NFTs exist
        const supplyResult = await client.view({
          payload: {
            function: NFT_FUNCTIONS.GET_CURRENT_SUPPLY as `${string}::${string}::${string}`,
            typeArguments: [],
            functionArguments: [collectionAddress],
          },
        });

        const currentSupply = Number(supplyResult[0]);

        if (currentSupply === 0) {
          return { items: [], total: 0 };
        }

        // Iterate through all token IDs and check ownership
        const nftHoldings: NftHolding[] = [];

        // Process in batches to avoid too many parallel requests
        const batchSize = 10;
        for (let startId = 1; startId <= currentSupply; startId += batchSize) {
          const endId = Math.min(startId + batchSize - 1, currentSupply);
          const promises: Promise<void>[] = [];

          for (let tokenId = startId; tokenId <= endId; tokenId++) {
            promises.push(
              (async () => {
                try {
                  // Get NFT address by token ID
                  const nftAddrResult = await client.view({
                    payload: {
                      function:
                        NFT_FUNCTIONS.GET_NFT_BY_TOKEN_ID as `${string}::${string}::${string}`,
                      typeArguments: [],
                      functionArguments: [collectionAddress, tokenId.toString()],
                    },
                  });

                  const nftAddress = nftAddrResult[0] as string;

                  // Get owner of this NFT using object ownership
                  const ownerResult = await client.view({
                    payload: {
                      function: NFT_FUNCTIONS.GET_OWNER as `${string}::${string}::${string}`,
                      typeArguments: [],
                      functionArguments: [nftAddress],
                    },
                  });

                  const owner = ownerResult[0] as string;

                  // Check if this NFT belongs to the connected address
                  // Use addressesEqual for proper comparison (handles addresses with/without leading zeros)
                  if (addressesEqual(owner, address)) {
                    nftHoldings.push({
                      nftAddress,
                      tokenId,
                      collectionAddress,
                    });
                  } else {
                    // NFT might be listed in marketplace (escrow owns it)
                    // Check if the user is the seller of this NFT
                    try {
                      const listingResult = await client.view({
                        payload: {
                          function:
                            MARKETPLACE_FUNCTIONS.GET_LISTING as `${string}::${string}::${string}`,
                          typeArguments: [],
                          functionArguments: [nftAddress],
                        },
                      });

                      const seller = listingResult[0] as string;
                      // If user is the seller, include this NFT in their holdings
                      if (addressesEqual(seller, address)) {
                        nftHoldings.push({
                          nftAddress,
                          tokenId,
                          collectionAddress,
                        });
                      }
                    } catch {
                      // NFT is not listed, that's fine - just not owned by user
                    }
                  }
                } catch (error) {
                  // NFT might have been burned, skip it
                  console.debug(`Error checking NFT #${tokenId}:`, error);
                }
              })()
            );
          }

          await Promise.all(promises);
        }

        // Sort by token ID
        nftHoldings.sort((a, b) => a.tokenId - b.tokenId);

        return {
          items: nftHoldings,
          total: nftHoldings.length,
        };
      } catch (error) {
        console.error('Error fetching NFT holdings:', error);
        return { items: [], total: 0 };
      }
    },
    enabled: !!address,
    retry: false,
    refetchInterval: 15000, // Increased to 15s since we're making more calls
    refetchOnWindowFocus: true,
    staleTime: 10000, // Cache results for 10 seconds
  });
};

// Listed NFT information (for marketplace)
export interface ListedNft {
  nftAddress: string;
  tokenId: number;
  collectionAddress: string;
  seller: string;
  price: number;
}

// Response type for listed NFTs query
export interface ListedNftsResult {
  items: ListedNft[];
  total: number;
}

/**
 * Hook to fetch all listed NFTs from the marketplace
 * Iterates through all minted NFTs and checks if they are listed
 */
export const useListedNfts = (): UseQueryResult<ListedNftsResult> => {
  const { network } = useWallet();

  return useQuery<ListedNftsResult>({
    queryKey: ['listedNfts', network?.chainId],
    queryFn: async () => {
      const client = getAptosClient();

      try {
        // First, get the collection address
        const collectionAddrResult = await client.view({
          payload: {
            function: NFT_FUNCTIONS.GET_COLLECTION_ADDRESS as `${string}::${string}::${string}`,
            typeArguments: [],
            functionArguments: [MODULE_ADDRESS],
          },
        });

        const collectionAddress = collectionAddrResult[0] as string;

        // Get current supply to know how many NFTs exist
        const supplyResult = await client.view({
          payload: {
            function: NFT_FUNCTIONS.GET_CURRENT_SUPPLY as `${string}::${string}::${string}`,
            typeArguments: [],
            functionArguments: [collectionAddress],
          },
        });

        const currentSupply = Number(supplyResult[0]);

        if (currentSupply === 0) {
          return { items: [], total: 0 };
        }

        // Iterate through all token IDs and check if listed
        const listedNfts: ListedNft[] = [];

        // Process in batches to avoid too many parallel requests
        const batchSize = 10;
        for (let startId = 1; startId <= currentSupply; startId += batchSize) {
          const endId = Math.min(startId + batchSize - 1, currentSupply);
          const promises: Promise<void>[] = [];

          for (let tokenId = startId; tokenId <= endId; tokenId++) {
            promises.push(
              (async () => {
                try {
                  // Get NFT address by token ID
                  const nftAddrResult = await client.view({
                    payload: {
                      function:
                        NFT_FUNCTIONS.GET_NFT_BY_TOKEN_ID as `${string}::${string}::${string}`,
                      typeArguments: [],
                      functionArguments: [collectionAddress, tokenId.toString()],
                    },
                  });

                  const nftAddress = nftAddrResult[0] as string;

                  // Check if this NFT is listed
                  try {
                    const listingResult = await client.view({
                      payload: {
                        function:
                          MARKETPLACE_FUNCTIONS.GET_LISTING as `${string}::${string}::${string}`,
                        typeArguments: [],
                        functionArguments: [nftAddress],
                      },
                    });

                    const seller = listingResult[0] as string;
                    const price = Number(listingResult[1]);

                    listedNfts.push({
                      nftAddress,
                      tokenId,
                      collectionAddress,
                      seller,
                      price,
                    });
                  } catch {
                    // NFT is not listed, skip
                  }
                } catch (error) {
                  // NFT might have been burned, skip it
                  console.debug(`Error checking NFT #${tokenId}:`, error);
                }
              })()
            );
          }

          await Promise.all(promises);
        }

        // Sort by token ID
        listedNfts.sort((a, b) => a.tokenId - b.tokenId);

        return {
          items: listedNfts,
          total: listedNfts.length,
        };
      } catch (error) {
        console.error('Error fetching listed NFTs:', error);
        return { items: [], total: 0 };
      }
    },
    retry: false,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });
};

/**
 * Hook to track a transaction by hash
 */
export const useTrackTransaction = (txHash: string | null) => {
  return useQuery({
    queryKey: ['transaction', txHash],
    queryFn: async () => {
      if (!txHash) throw new Error('Transaction hash is required');

      const client = getAptosClient();
      const txn = await client.getTransactionByHash({ transactionHash: txHash });
      return txn;
    },
    enabled: !!txHash,
    refetchInterval: (query) => {
      const data = query.state.data as { type?: string } | undefined;
      // Keep polling if transaction is pending
      return data?.type === 'pending_transaction' ? 3000 : false;
    },
    retry: false,
    refetchIntervalInBackground: true,
  });
};

// Floor listing information
export interface FloorListing {
  nftAddress: string;
  tokenId: number;
  collectionAddress: string;
  seller: string;
  price: number; // in octas (8 decimals)
}

// Response type for floor listing query
export interface FloorListingResult {
  floor: FloorListing | null;
  totalListings: number;
}

/**
 * Hook to fetch the floor (cheapest) listing from the marketplace
 * Returns the cheapest listed NFT and total listing count
 * Excludes NFTs listed by the strategy treasury to prevent self-buying
 */
export const useFloorListing = (): UseQueryResult<FloorListingResult> => {
  const { network } = useWallet();

  return useQuery<FloorListingResult>({
    queryKey: ['floorListing', network?.chainId],
    queryFn: async () => {
      const client = getAptosClient();

      try {
        // First, try to get the treasury address to exclude treasury listings
        let treasuryAddress: string | null = null;
        try {
          const treasuryResult = await client.view({
            payload: {
              function:
                STRATEGY_FUNCTIONS.GET_TREASURY_ADDRESS as `${string}::${string}::${string}`,
              typeArguments: [],
              functionArguments: [],
            },
          });
          treasuryAddress = treasuryResult[0] as string;
        } catch {
          // Strategy not initialized, no treasury to exclude
        }

        // Get the collection address
        const collectionAddrResult = await client.view({
          payload: {
            function: NFT_FUNCTIONS.GET_COLLECTION_ADDRESS as `${string}::${string}::${string}`,
            typeArguments: [],
            functionArguments: [MODULE_ADDRESS],
          },
        });

        const collectionAddress = collectionAddrResult[0] as string;

        // Get current supply to know how many NFTs exist
        const supplyResult = await client.view({
          payload: {
            function: NFT_FUNCTIONS.GET_CURRENT_SUPPLY as `${string}::${string}::${string}`,
            typeArguments: [],
            functionArguments: [collectionAddress],
          },
        });

        const currentSupply = Number(supplyResult[0]);

        if (currentSupply === 0) {
          return { floor: null, totalListings: 0 };
        }

        // Find all listings and track the cheapest
        // Use an object to hold the floor listing so it can be mutated in async closures
        const state: { floor: FloorListing | null; totalListings: number } = {
          floor: null,
          totalListings: 0,
        };

        // Process in batches to avoid too many parallel requests
        const batchSize = 10;
        for (let startId = 1; startId <= currentSupply; startId += batchSize) {
          const endId = Math.min(startId + batchSize - 1, currentSupply);
          const promises: Promise<void>[] = [];

          for (let tokenId = startId; tokenId <= endId; tokenId++) {
            promises.push(
              (async () => {
                try {
                  // Get NFT address by token ID
                  const nftAddrResult = await client.view({
                    payload: {
                      function:
                        NFT_FUNCTIONS.GET_NFT_BY_TOKEN_ID as `${string}::${string}::${string}`,
                      typeArguments: [],
                      functionArguments: [collectionAddress, tokenId.toString()],
                    },
                  });

                  const nftAddress = nftAddrResult[0] as string;

                  // Check if this NFT is listed
                  try {
                    const listingResult = await client.view({
                      payload: {
                        function:
                          MARKETPLACE_FUNCTIONS.GET_LISTING as `${string}::${string}::${string}`,
                        typeArguments: [],
                        functionArguments: [nftAddress],
                      },
                    });

                    const seller = listingResult[0] as string;
                    const price = Number(listingResult[1]);

                    // Skip listings from the treasury address to prevent self-buying
                    if (treasuryAddress && addressesEqual(seller, treasuryAddress)) {
                      return; // Skip this listing
                    }

                    state.totalListings++;

                    // Track the cheapest listing
                    if (state.floor === null || price < state.floor.price) {
                      state.floor = {
                        nftAddress,
                        tokenId,
                        collectionAddress,
                        seller,
                        price,
                      };
                    }
                  } catch {
                    // NFT is not listed, skip
                  }
                } catch (error) {
                  // NFT might have been burned, skip it
                  console.debug(`Error checking NFT #${tokenId}:`, error);
                }
              })()
            );
          }

          await Promise.all(promises);
        }

        return {
          floor: state.floor,
          totalListings: state.totalListings,
        };
      } catch (error) {
        console.error('Error fetching floor listing:', error);
        return { floor: null, totalListings: 0 };
      }
    },
    retry: false,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });
};
