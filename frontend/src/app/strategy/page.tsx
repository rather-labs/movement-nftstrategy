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
  fetchLpTokenBalance,
  fetchRatherTokenBalance,
  fetchStrategyMetrics,
} from '@/lib/strategy/operations';
import { fetchPoolReserves, fromOnChainAmount, toOnChainAmount } from '@/lib/pool/operations';
import { MODULE_ADDRESS } from '@/constants/contracts';
import { useNftHoldings } from '@/hooks/useNftHoldings';
import { TokenImage } from '@/components/nft/TokenImage';

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

  // Strategy's NFT holdings (owned by deployer/MODULE_ADDRESS)
  const { data: strategyNfts, isLoading: nftsLoading } = useNftHoldings(MODULE_ADDRESS);

  // Computed values
  const treasuryBalance = useMemo(() => {
    if (!poolReserves) return 0;
    return fromOnChainAmount(poolReserves.reserveY); // WMOVE in pool
  }, [poolReserves]);

  const burnableBalance = useMemo(() => {
    // For now, use RATHER reserve as proxy for burnable amount
    if (!poolReserves) return 0;
    return fromOnChainAmount(poolReserves.reserveX);
  }, [poolReserves]);

  const floorPrice = useMemo(() => {
    // TODO: Implement floor listing detection via indexer
    return null as number | null;
  }, []);

  const purchaseProgress = useMemo(() => {
    if (!floorPrice || treasuryBalance <= 0) return 0;
    return Math.min((treasuryBalance / floorPrice) * 100, 100);
  }, [treasuryBalance, floorPrice]);

  // Burned RATHER stats (placeholder - needs actual implementation)
  const burnedRather = 0;
  const totalSupplyRather = 1_000_000; // Placeholder
  const burnedPercentage = totalSupplyRather > 0 ? (burnedRather / totalSupplyRather) * 100 : 0;

  const refreshAll = useCallback(() => {
    void refetchPool();
    void refetchMetrics();
    void refetchRather();
  }, [refetchPool, refetchMetrics, refetchRather]);

  const handleBuyFloor = useCallback(async () => {
    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before executing strategy actions.',
        status: 'warning',
      });
      return;
    }

    if (!floorPrice) {
      toast({
        title: 'No floor listing available',
        description: 'The marketplace does not currently have a floor listing to purchase.',
        status: 'info',
      });
      return;
    }

    setIsBuyingFloor(true);
    try {
      // TODO: Implement buy and relist transaction
      toast({
        title: 'Coming soon',
        description: 'Buy floor & relist functionality is under development.',
        status: 'info',
      });
    } catch (error: any) {
      toast({
        title: 'Buy floor failed',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsBuyingFloor(false);
    }
  }, [currentAddress, floorPrice, toast]);

  const handleBurn = useCallback(async () => {
    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before executing strategy actions.',
        status: 'warning',
      });
      return;
    }

    setIsBurning(true);
    try {
      // TODO: Implement buy RATHER and burn transaction
      toast({
        title: 'Coming soon',
        description: 'Buy RATHER & burn functionality is under development.',
        status: 'info',
      });
    } catch (error: any) {
      toast({
        title: 'Burn failed',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsBurning(false);
    }
  }, [currentAddress, toast]);

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
                    {poolLoading ? '—' : `${treasuryBalance.toFixed(3)} WMOVE`}
                  </StatNumber>
                  <StatHelpText mt={1} color="text.tertiary">
                    Portion of the strategy reserved for NFT purchases.
                  </StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Burnable Balance</StatLabel>
                  <StatNumber>
                    {poolLoading ? '—' : `${burnableBalance.toFixed(3)} RATHER`}
                  </StatNumber>
                  <StatHelpText mt={1} color="text.tertiary">
                    Total RATHER accrued on NFT sales.
                  </StatHelpText>
                </Stat>
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
                    {metricsLoading
                      ? '—'
                      : floorPrice !== null
                        ? `${floorPrice.toFixed(2)} WMOVE`
                        : 'No listings'}
                  </StatNumber>
                </Stat>
                {metrics?.floorListing && (
                  <Text fontSize="sm" color="text.secondary">
                    NFT {metrics.floorListing.nftAddress.slice(0, 8)}… by{' '}
                    {metrics.floorListing.seller?.slice(0, 6)}…
                  </Text>
                )}
                <Stack spacing={2}>
                  <Text fontSize="sm" color="text.secondary">
                    Progress toward next floor purchase
                  </Text>
                  <Progress
                    value={purchaseProgress}
                    colorScheme="purple"
                    size="sm"
                    borderRadius="full"
                    isIndeterminate={metricsLoading}
                  />
                  <Text fontSize="xs" color="text.tertiary">
                    {metricsLoading
                      ? 'Calculating progress…'
                      : floorPrice
                        ? `${purchaseProgress.toFixed(0)}% of ${floorPrice.toFixed(2)} WMOVE target`
                        : 'No active marketplace listing detected.'}
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
                  <Link
                    color="link.primary"
                    href={getAccountExplorerLink(MODULE_ADDRESS)}
                    isExternal
                  >
                    {MODULE_ADDRESS.slice(0, 8)}…{MODULE_ADDRESS.slice(-6)}
                  </Link>
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
                  Execute the automated steps directly from your connected wallet.
                </Text>
              </Stack>
              <HStack spacing={3}>
                <Button
                  colorScheme="purple"
                  onClick={handleBuyFloor}
                  isLoading={isBuyingFloor}
                  isDisabled={!floorPrice || !currentAddress}
                >
                  Buy Floor &amp; Relist
                </Button>
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
              it at a premium. The burn action routes available WMOVE through the liquidity pool,
              acquires RATHER, and burns it to reduce supply.
            </Text>
          </CardBody>
        </Card>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {/* Current Holdings - NFTs owned by strategy */}
          <Card>
            <CardHeader>
              <Stack spacing={1}>
                <HStack spacing={2} align="center">
                  <Heading size="md">Current Holdings</Heading>
                  <Badge colorScheme="purple">{strategyNfts?.total ?? 0} NFTs</Badge>
                </HStack>
                <Text fontSize="sm" color="text.secondary">
                  NFTs currently owned by the strategy address.
                </Text>
              </Stack>
            </CardHeader>
            <Divider />
            <CardBody>
              {nftsLoading ? (
                <Center py={8}>
                  <Spinner size="lg" />
                </Center>
              ) : strategyNfts && strategyNfts.items.length > 0 ? (
                <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} spacing={4}>
                  {strategyNfts.items.map((nft) => (
                    <Box key={nft.nftAddress} borderRadius="lg" overflow="hidden" bg="gray.50">
                      <TokenImage nftAddress={nft.nftAddress} alt={`NFT #${nft.tokenId}`} />
                      <Box p={2}>
                        <Text fontSize="sm" fontWeight="medium" textAlign="center">
                          #{nft.tokenId}
                        </Text>
                      </Box>
                    </Box>
                  ))}
                </SimpleGrid>
              ) : (
                <Center py={8}>
                  <Text color="text.secondary">No NFTs currently held by the strategy.</Text>
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
                    <StatNumber>{`${burnedRather.toFixed(3)} RATHER`}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Supply Reduced</StatLabel>
                    <StatNumber>{`${burnedPercentage.toFixed(2)}%`}</StatNumber>
                    <StatHelpText mt={1} color="text.tertiary">
                      Initial supply{' '}
                      {totalSupplyRather.toLocaleString(undefined, {
                        maximumFractionDigits: 3,
                        minimumFractionDigits: 0,
                      })}{' '}
                      RATHER
                    </StatHelpText>
                  </Stat>
                </SimpleGrid>
                <Stack spacing={2}>
                  <Text fontSize="sm" color="text.secondary">
                    Burn progress against total supply
                  </Text>
                  <Progress
                    value={burnedPercentage}
                    colorScheme="orange"
                    size="sm"
                    borderRadius="full"
                  />
                  <Text fontSize="xs" color="text.tertiary">
                    {burnedPercentage > 0
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
