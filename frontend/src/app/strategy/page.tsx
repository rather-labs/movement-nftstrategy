'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Center,
  Container,
  Divider,
  Flex,
  Heading,
  HStack,
  Link,
  SimpleGrid,
  Spinner,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Text,
  useToast,
  VStack,
  Progress,
  Tooltip,
  Box,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/lib/wallet-context';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { getExplorerLink, getAccountExplorerLink } from '@/utils/explorer-links';
import { waitForTransaction } from '@/lib/movement-client';
import {
  buildMintRatherTokenTransaction,
  buildBuyFloorAndRelistTransaction,
  buildBuyRatherAndBurnTransaction,
  fetchLpTokenBalance,
  fetchRatherTokenBalance,
  fetchRatherTokenStats,
  fetchStrategyMetrics,
  fetchTreasuryWmoveBalance,
  fetchTreasuryRatherBalance,
  fetchStrategyTreasuryWmoveBalance,
  fetchBurnableBalance,
  fetchTotalRatherBurned,
  isStrategyInitialized,
  fetchStrategyTreasuryAddress,
} from '@/lib/strategy/operations';
import { fetchPoolReserves, fromOnChainAmount, toOnChainAmount } from '@/lib/pool/operations';
import { MODULE_ADDRESS } from '@/constants/contracts';
import { useNftHoldings, useFloorListing, useListedNfts } from '@/hooks/useNftHoldings';
import { TokenImage } from '@/components/nft/TokenImage';
import { addressesEqual } from '@/utils/formatting';

export default function StrategyDashboard() {
  const toast = useToast();
  const currentAddress = useCurrentAddress();
  const { signAndSubmitTransaction, connected } = useWallet();

  const [pendingBuyTxId, setPendingBuyTxId] = useState<string | null>(null);
  const [pendingBurnTxId, setPendingBurnTxId] = useState<string | null>(null);
  const [isBuyingFloor, setIsBuyingFloor] = useState(false);
  const [isBurning, setIsBurning] = useState(false);

  // Pool reserves
  const {
    data: poolReserves,
    isLoading: poolLoading,
    refetch: refetchPool,
  } = useQuery({
    queryKey: ['strategy-pool-reserves'],
    queryFn: () => fetchPoolReserves(),
    refetchInterval: 15000,
  });

  // Treasury address from strategy contract
  const { data: treasuryAddress } = useQuery({
    queryKey: ['strategy-treasury-address'],
    queryFn: () => fetchStrategyTreasuryAddress(),
    refetchInterval: 60000,
  });

  // Treasury WMOVE balance
  const {
    data: treasuryWmove = 0,
    isLoading: treasuryWmoveLoading,
    refetch: refetchTreasuryWmove,
  } = useQuery({
    queryKey: ['treasury-wmove-balance'],
    queryFn: () => fetchTreasuryWmoveBalance(),
    refetchInterval: 15000,
  });

  // Treasury RATHER balance (burnable)
  const {
    data: treasuryRather = 0,
    isLoading: treasuryRatherLoading,
    refetch: refetchTreasuryRather,
  } = useQuery({
    queryKey: ['treasury-rather-balance'],
    queryFn: () => fetchTreasuryRatherBalance(),
    refetchInterval: 15000,
  });

  // Burnable balance (native MOVE from NFT sale proceeds)
  const {
    data: burnableMoveBalance = 0,
    isLoading: burnableLoading,
    refetch: refetchBurnableBalance,
  } = useQuery({
    queryKey: ['burnable-balance'],
    queryFn: () => fetchBurnableBalance(),
    refetchInterval: 15000,
  });

  // Total RATHER burned by strategy
  const {
    data: totalStrategyBurned = 0,
    isLoading: strategyBurnedLoading,
    refetch: refetchStrategyBurned,
  } = useQuery({
    queryKey: ['total-strategy-burned'],
    queryFn: () => fetchTotalRatherBurned(),
    refetchInterval: 15000,
  });

  // User's RATHER token balance
  const {
    data: ratherBalance = 0,
    isLoading: ratherLoading,
    refetch: refetchRather,
  } = useQuery({
    queryKey: ['rather-balance', currentAddress],
    queryFn: () => fetchRatherTokenBalance(currentAddress!),
    enabled: !!currentAddress,
    refetchInterval: 30000,
  });

  // User's LP token balance
  const { data: lpBalance = 0, isLoading: lpLoading } = useQuery({
    queryKey: ['lp-balance', currentAddress],
    queryFn: () => fetchLpTokenBalance(currentAddress!),
    enabled: !!currentAddress,
    refetchInterval: 30000,
  });

  // Strategy metrics
  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['strategy-metrics'],
    queryFn: () => fetchStrategyMetrics(),
    refetchInterval: 15000,
  });

  // Floor listing from marketplace
  const {
    data: floorListingData,
    isLoading: floorListingLoading,
    refetch: refetchFloorListing,
  } = useFloorListing();

  // All listed NFTs from marketplace
  const { data: allListedNfts, isLoading: listedNftsLoading } = useListedNfts();

  // Strategy's NFT holdings (owned by deployer/MODULE_ADDRESS - for non-listed NFTs)
  const { data: strategyNfts, isLoading: nftsLoading } = useNftHoldings(MODULE_ADDRESS);

  // Treasury's listed NFTs - filter all listings to find those where seller is treasury or MODULE_ADDRESS
  const treasuryListedNfts = useMemo(() => {
    if (!allListedNfts?.items) return [];
    return allListedNfts.items.filter(
      (nft) =>
        (MODULE_ADDRESS && addressesEqual(nft.seller, MODULE_ADDRESS)) ||
        (treasuryAddress && addressesEqual(nft.seller, treasuryAddress))
    );
  }, [allListedNfts, treasuryAddress]);

  // Combined holdings: both owned NFTs and listed NFTs by treasury
  const allTreasuryNfts = useMemo(() => {
    const ownedNfts = strategyNfts?.items ?? [];
    // Create a set of listed NFT addresses to avoid duplicates
    const listedAddresses = new Set(treasuryListedNfts.map((nft) => nft.nftAddress));
    // Filter out owned NFTs that are also listed (to avoid duplicates)
    const ownedNotListed = ownedNfts.filter((nft) => !listedAddresses.has(nft.nftAddress));
    // Return all listed + owned (not listed)
    return [
      ...treasuryListedNfts.map((nft) => ({ ...nft, isListed: true, listPrice: nft.price })),
      ...ownedNotListed.map((nft) => ({ ...nft, isListed: false, listPrice: undefined })),
    ];
  }, [strategyNfts, treasuryListedNfts]);

  // RATHER token stats (total minted, burned, current supply)
  const {
    data: ratherStats,
    isLoading: ratherStatsLoading,
    refetch: refetchRatherStats,
  } = useQuery({
    queryKey: ['rather-token-stats'],
    queryFn: () => fetchRatherTokenStats(),
    refetchInterval: 15000,
  });

  // Computed values
  const treasuryBalance = useMemo(() => {
    // Treasury balance is the WMOVE balance of the treasury address
    return fromOnChainAmount(treasuryWmove);
  }, [treasuryWmove]);

  const burnableBalance = useMemo(() => {
    // Burnable balance is the native MOVE balance of the treasury (from NFT sale proceeds)
    return fromOnChainAmount(burnableMoveBalance);
  }, [burnableMoveBalance]);

  // Total RATHER burned by the strategy contract
  const strategyBurnedRather = useMemo(() => {
    return fromOnChainAmount(totalStrategyBurned);
  }, [totalStrategyBurned]);

  // Floor listing from marketplace - get the cheapest listed NFT
  const floorListing = useMemo(() => {
    return floorListingData?.floor ?? null;
  }, [floorListingData]);

  const floorPrice = useMemo(() => {
    if (!floorListing) return null;
    return fromOnChainAmount(floorListing.price);
  }, [floorListing]);

  const purchaseProgress = useMemo(() => {
    if (!floorPrice || treasuryBalance <= 0) return 0;
    return Math.min((treasuryBalance / floorPrice) * 100, 100);
  }, [treasuryBalance, floorPrice]);

  const canExecuteBuyFloor = useMemo(() => {
    // Can execute if there's a floor listing and treasury has enough WMOVE
    return floorListing !== null && floorPrice !== null && treasuryBalance >= floorPrice;
  }, [floorListing, floorPrice, treasuryBalance]);

  // RATHER token stats from on-chain data
  const burnedRather = useMemo(() => {
    return fromOnChainAmount(ratherStats?.totalBurned ?? 0);
  }, [ratherStats]);

  const totalSupplyRather = useMemo(() => {
    // Total supply is total minted (initial supply)
    return fromOnChainAmount(ratherStats?.totalMinted ?? 0);
  }, [ratherStats]);

  const burnedPercentage = useMemo(() => {
    if (!totalSupplyRather || totalSupplyRather === 0) return 0;
    return (burnedRather / totalSupplyRather) * 100;
  }, [burnedRather, totalSupplyRather]);

  const moduleAddress = MODULE_ADDRESS ?? '';
  const moduleAddressDisplay = moduleAddress
    ? `${moduleAddress.slice(0, 8)}…${moduleAddress.slice(-6)}`
    : 'Not configured';

  const refreshAll = useCallback(() => {
    void refetchPool();
    void refetchMetrics();
    void refetchRather();
    void refetchTreasuryWmove();
    void refetchTreasuryRather();
    void refetchBurnableBalance();
    void refetchStrategyBurned();
    void refetchRatherStats();
    void refetchFloorListing();
  }, [
    refetchPool,
    refetchMetrics,
    refetchRather,
    refetchTreasuryWmove,
    refetchTreasuryRather,
    refetchBurnableBalance,
    refetchStrategyBurned,
    refetchRatherStats,
    refetchFloorListing,
  ]);

  const handleBuyFloor = useCallback(async () => {
    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before executing strategy actions.',
        status: 'warning',
      });
      return;
    }

    if (!floorListing || !floorPrice) {
      toast({
        title: 'No floor listing available',
        description: 'The marketplace does not currently have a floor listing to purchase.',
        status: 'info',
      });
      return;
    }

    if (!canExecuteBuyFloor) {
      toast({
        title: 'Insufficient treasury balance',
        description: `Treasury needs ${floorPrice.toFixed(4)} WMOVE but only has ${treasuryBalance.toFixed(4)} WMOVE.`,
        status: 'warning',
      });
      return;
    }

    setIsBuyingFloor(true);
    try {
      // Build the buy floor and relist transaction
      const transaction = buildBuyFloorAndRelistTransaction(floorListing.nftAddress);

      // Sign and submit the transaction
      const response = await signAndSubmitTransaction(transaction);
      const txHash = response.hash;
      setPendingBuyTxId(txHash);

      toast({
        title: 'Transaction submitted',
        description: `Buying floor NFT #${floorListing.tokenId} and relisting with 10% premium...`,
        status: 'info',
        duration: 5000,
      });

      // Wait for transaction confirmation
      await waitForTransaction(txHash);

      toast({
        title: 'Floor buy & relist successful!',
        description: `Purchased NFT #${floorListing.tokenId} for ${floorPrice.toFixed(4)} MOVE and relisted at ${(floorPrice * 1.1).toFixed(4)} MOVE.`,
        status: 'success',
        duration: 8000,
      });

      // Refresh all data
      refreshAll();
    } catch (error: any) {
      toast({
        title: 'Buy floor failed',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsBuyingFloor(false);
    }
  }, [
    currentAddress,
    floorListing,
    floorPrice,
    canExecuteBuyFloor,
    treasuryBalance,
    signAndSubmitTransaction,
    refreshAll,
    toast,
  ]);

  const handleBurn = useCallback(async () => {
    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before executing strategy actions.',
        status: 'warning',
      });
      return;
    }

    if (burnableBalance <= 0) {
      toast({
        title: 'No burnable balance',
        description: 'The treasury has no MOVE proceeds from NFT sales to burn.',
        status: 'info',
      });
      return;
    }

    setIsBurning(true);
    try {
      // Build the buy RATHER and burn transaction
      const transaction = buildBuyRatherAndBurnTransaction();

      // Sign and submit the transaction
      const response = await signAndSubmitTransaction(transaction);
      const txHash = response.hash;
      setPendingBurnTxId(txHash);

      toast({
        title: 'Transaction submitted',
        description: `Wrapping ${burnableBalance.toFixed(4)} MOVE, swapping to RATHER, and burning...`,
        status: 'info',
        duration: 5000,
      });

      // Wait for transaction confirmation
      await waitForTransaction(txHash);

      toast({
        title: 'Buy RATHER & Burn successful!',
        description: `Used ${burnableBalance.toFixed(4)} MOVE to buy and burn RATHER tokens.`,
        status: 'success',
        duration: 8000,
      });

      // Refresh all data
      refreshAll();
    } catch (error: any) {
      toast({
        title: 'Burn failed',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsBurning(false);
    }
  }, [currentAddress, burnableBalance, signAndSubmitTransaction, refreshAll, toast]);

  return (
    <Container maxW="6xl" py={10}>
      <VStack align="stretch" spacing={8}>
        <Stack spacing={2}>
          <Heading size="lg">Strategy Dashboard</Heading>
          <Text color="text.secondary">
            Monitor strategy treasury, marketplace floor, and execution on Movement testnet.
          </Text>
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          {/* Treasury Card */}
          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Stat>
                  <StatLabel>Treasury Balance</StatLabel>
                  <StatNumber>
                    {treasuryWmoveLoading ? '—' : `${treasuryBalance.toFixed(3)} WMOVE`}
                  </StatNumber>
                  <StatHelpText mt={1} color="text.tertiary">
                    WMOVE for floor buying (
                    {treasuryAddress ? `${treasuryAddress.slice(0, 8)}…` : '—'})
                  </StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Burnable Balance</StatLabel>
                  <StatNumber>
                    {burnableLoading ? '—' : `${burnableBalance.toFixed(3)} MOVE`}
                  </StatNumber>
                  <StatHelpText mt={1} color="text.tertiary">
                    Native MOVE from NFT sale proceeds. Use to buy &amp; burn RATHER.
                  </StatHelpText>
                </Stat>
                {strategyBurnedRather > 0 && (
                  <Stat size="sm">
                    <StatLabel>Strategy Burned</StatLabel>
                    <StatNumber fontSize="md" color="orange.500">
                      {strategyBurnedRather.toFixed(3)} RATHER
                    </StatNumber>
                  </Stat>
                )}
                {pendingBurnTxId && (
                  <Link
                    fontSize="sm"
                    color="link.primary"
                    href={getExplorerLink(pendingBurnTxId, 'testnet')}
                    isExternal
                  >
                    View burn transaction <ExternalLinkIcon mx="4px" />
                  </Link>
                )}
              </Stack>
            </CardBody>
          </Card>

          {/* Floor Listing Card */}
          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Stat>
                  <StatLabel>Floor Listing</StatLabel>
                  <StatNumber>
                    {floorListingLoading
                      ? '—'
                      : floorPrice !== null
                        ? `${floorPrice.toFixed(4)} MOVE`
                        : 'No listings'}
                  </StatNumber>
                </Stat>
                {floorListing && (
                  <HStack spacing={3}>
                    <Box w="48px" h="48px" borderRadius="md" overflow="hidden" flexShrink={0}>
                      <TokenImage
                        nftAddress={floorListing.nftAddress}
                        alt={`NFT #${floorListing.tokenId}`}
                      />
                    </Box>
                    <Stack spacing={0}>
                      <Text fontSize="sm" fontWeight="medium">
                        Robot #{floorListing.tokenId}
                      </Text>
                      <Text fontSize="xs" color="text.tertiary">
                        Seller: {floorListing.seller.slice(0, 6)}…{floorListing.seller.slice(-4)}
                      </Text>
                    </Stack>
                  </HStack>
                )}
                <Stack spacing={2}>
                  <Text fontSize="sm" color="text.secondary">
                    Progress toward next floor purchase
                  </Text>
                  <Progress
                    value={purchaseProgress}
                    colorScheme={canExecuteBuyFloor ? 'green' : 'purple'}
                    size="sm"
                    borderRadius="full"
                    isIndeterminate={floorListingLoading}
                  />
                  <Text fontSize="xs" color="text.tertiary">
                    {floorListingLoading
                      ? 'Scanning marketplace…'
                      : floorPrice
                        ? canExecuteBuyFloor
                          ? `✓ Ready! ${treasuryBalance.toFixed(4)} / ${floorPrice.toFixed(4)} WMOVE`
                          : `${purchaseProgress.toFixed(0)}% — Need ${(floorPrice - treasuryBalance).toFixed(4)} more WMOVE`
                        : 'No active marketplace listings detected.'}
                  </Text>
                </Stack>
                {pendingBuyTxId && (
                  <Link
                    fontSize="sm"
                    color="link.primary"
                    href={getExplorerLink(pendingBuyTxId, 'testnet')}
                    isExternal
                  >
                    View buy transaction <ExternalLinkIcon mx="4px" />
                  </Link>
                )}
              </Stack>
            </CardBody>
          </Card>

          {/* Module Address Card */}
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Module Address</StatLabel>
                <StatNumber fontSize="lg">
                  {moduleAddress ? (
                    <Link
                      color="link.primary"
                      href={getAccountExplorerLink(moduleAddress)}
                      isExternal
                    >
                      {moduleAddressDisplay}
                    </Link>
                  ) : (
                    <Text color="text.secondary">Module address not configured</Text>
                  )}
                </StatNumber>
                <StatHelpText mt={2}>
                  <Badge colorScheme="purple">Movement Testnet</Badge>
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Strategy Actions */}
        <Card>
          <CardHeader>
            <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
              <Stack spacing={2}>
                <Heading size="md">Strategy Actions</Heading>
                <Text fontSize="sm" color="text.secondary">
                  Execute automated strategy steps. Any user can trigger these actions on behalf of
                  the treasury.
                </Text>
              </Stack>
              <HStack spacing={3}>
                <Tooltip
                  label={
                    !currentAddress
                      ? 'Connect wallet to execute'
                      : !floorListing
                        ? 'No floor listing available'
                        : !canExecuteBuyFloor
                          ? `Need ${floorPrice ? (floorPrice - treasuryBalance).toFixed(4) : '0'} more WMOVE`
                          : `Buy NFT #${floorListing?.tokenId} for ${floorPrice?.toFixed(4)} MOVE and relist at ${(floorPrice! * 1.1).toFixed(4)} MOVE`
                  }
                  hasArrow
                >
                  <Button
                    colorScheme={canExecuteBuyFloor ? 'green' : 'purple'}
                    onClick={handleBuyFloor}
                    isLoading={isBuyingFloor}
                    isDisabled={!canExecuteBuyFloor || !currentAddress}
                  >
                    Buy Floor &amp; Relist
                  </Button>
                </Tooltip>
                <Button
                  colorScheme="red"
                  variant="outline"
                  onClick={handleBurn}
                  isLoading={isBurning}
                  isDisabled={!currentAddress || burnableBalance === 0}
                >
                  Buy RATHER &amp; Burn
                </Button>
              </HStack>
            </Flex>
          </CardHeader>
          <Divider />
          <CardBody>
            <Text fontSize="sm" color="text.secondary">
              The buy action consumes treasury WMOVE to purchase the lowest-priced NFT and relists
              it at a 10% premium. The burn action takes MOVE from NFT sale proceeds, wraps to
              WMOVE, swaps for RATHER through the liquidity pool, and burns it to reduce supply.
            </Text>
          </CardBody>
        </Card>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {/* Current Holdings - NFTs owned/listed by treasury */}
          <Card>
            <CardHeader>
              <Stack spacing={1}>
                <HStack spacing={2} align="center">
                  <Heading size="md">Current Holdings</Heading>
                  <Badge colorScheme="purple">{allTreasuryNfts.length} NFTs</Badge>
                </HStack>
                <Text fontSize="sm" color="text.secondary">
                  NFTs held or listed by the treasury in the marketplace.
                </Text>
              </Stack>
            </CardHeader>
            <Divider />
            <CardBody>
              {nftsLoading || listedNftsLoading ? (
                <Center py={8}>
                  <Spinner size="lg" />
                </Center>
              ) : allTreasuryNfts.length > 0 ? (
                <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} spacing={4}>
                  {allTreasuryNfts.map((nft) => (
                    <Box
                      key={nft.nftAddress}
                      borderRadius="lg"
                      overflow="hidden"
                      bg="gray.50"
                      position="relative"
                    >
                      <TokenImage nftAddress={nft.nftAddress} alt={`NFT #${nft.tokenId}`} />
                      {nft.isListed && (
                        <Badge
                          colorScheme="green"
                          position="absolute"
                          top={2}
                          right={2}
                          fontSize="xs"
                        >
                          Listed
                        </Badge>
                      )}
                      <Box p={2}>
                        <Text fontSize="sm" fontWeight="medium" textAlign="center">
                          #{nft.tokenId}
                        </Text>
                        {nft.isListed && nft.listPrice && (
                          <Text fontSize="xs" color="green.600" textAlign="center">
                            {fromOnChainAmount(nft.listPrice).toFixed(2)} MOVE
                          </Text>
                        )}
                      </Box>
                    </Box>
                  ))}
                </SimpleGrid>
              ) : (
                <Center py={8}>
                  <Text color="text.secondary">No NFTs currently held by the treasury.</Text>
                </Center>
              )}
            </CardBody>
          </Card>

          {/* Burned RATHER */}
          <Card>
            <CardHeader>
              <Stack spacing={1}>
                <Heading size="md">Burned RATHER</Heading>
              </Stack>
            </CardHeader>
            <Divider />
            <Text fontSize="sm" color="text.secondary" mt={3} textAlign="center" px={6}>
              Tracks cumulative RATHER removed from circulation by the strategy.
            </Text>
            <CardBody>
              <Stack spacing={5}>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  <Stat>
                    <StatLabel>Total Burned</StatLabel>
                    <StatNumber>
                      {ratherStatsLoading ? '—' : `${burnedRather.toFixed(3)} RATHER`}
                    </StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Supply Reduced</StatLabel>
                    <StatNumber>
                      {ratherStatsLoading ? '—' : `${burnedPercentage.toFixed(2)}%`}
                    </StatNumber>
                    <StatHelpText mt={1} color="text.tertiary">
                      Total minted{' '}
                      {ratherStatsLoading
                        ? '—'
                        : totalSupplyRather.toLocaleString(undefined, {
                            maximumFractionDigits: 3,
                            minimumFractionDigits: 0,
                          })}{' '}
                      RATHER
                    </StatHelpText>
                  </Stat>
                </SimpleGrid>
                <Stack spacing={2}>
                  <Text fontSize="sm" color="text.secondary">
                    Burn progress against total minted
                  </Text>
                  <Progress
                    value={burnedPercentage}
                    colorScheme="orange"
                    size="sm"
                    borderRadius="full"
                    isIndeterminate={ratherStatsLoading}
                  />
                  <Text fontSize="xs" color="text.tertiary">
                    {ratherStatsLoading
                      ? 'Loading burn stats...'
                      : burnedPercentage > 0
                        ? `${burnedPercentage.toFixed(2)}% permanently removed from circulation.`
                        : 'No RATHER has been burned yet.'}
                  </Text>
                </Stack>
              </Stack>
            </CardBody>
          </Card>
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
