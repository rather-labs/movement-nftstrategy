import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { useWallet } from '@/lib/wallet-context';
import { getAptosClient } from '@/lib/movement-client';
import { MODULE_ADDRESS } from '@/constants/contracts';

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
 * Uses the Movement indexer to query owned objects
 */
export const useNftHoldings = (address?: string): UseQueryResult<NftHoldingsResult> => {
  const { network } = useWallet();

  return useQuery<NftHoldingsResult>({
    queryKey: ['nftHoldings', address, network?.chainId],
    queryFn: async () => {
      if (!address) throw new Error('Address is required');

      const client = getAptosClient();

      try {
        // Query owned objects of type NFT
        // Note: This uses the Aptos indexer API which may need to be enabled on Movement
        const resources = await client.getAccountOwnedObjects({
          accountAddress: address,
          options: {
            limit: 100,
          },
        });

        // Filter for NFTs from our collection module
        const nftHoldings: NftHolding[] = [];

        for (const obj of resources) {
          const objectAddress = obj.object_address;

          // Check if this object has our NFT resource
          try {
            const nftResource = await client.getAccountResource({
              accountAddress: objectAddress,
              resourceType: `${MODULE_ADDRESS}::nft_collection::NFT`,
            });

            if (nftResource) {
              const data = nftResource as { collection: string; token_id: string };
              nftHoldings.push({
                nftAddress: objectAddress,
                tokenId: Number(data.token_id),
                collectionAddress: data.collection,
              });
            }
          } catch {
            // Object is not an NFT from our collection, skip
          }
        }

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
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
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
