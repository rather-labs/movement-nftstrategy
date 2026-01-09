import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { fetchTokenUri } from '@/lib/nft/operations';

/**
 * Hook to fetch the token URI for an NFT
 * @param nftAddress - The address of the NFT object
 */
export const useTokenUri = (nftAddress?: string): UseQueryResult<string | undefined> => {
  return useQuery({
    queryKey: ['tokenUri', nftAddress],
    queryFn: async () => {
      if (!nftAddress) return undefined;
      return fetchTokenUri(nftAddress);
    },
    enabled: !!nftAddress,
    staleTime: 1000 * 60 * 5, // 5 minutes - URIs don't change often
    retry: 1,
  });
};
