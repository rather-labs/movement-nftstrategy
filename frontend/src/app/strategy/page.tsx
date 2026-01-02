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
  Heading,
  HStack,
  Link,
  SimpleGrid,
  Spinner,
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
import { getExplorerLink } from '@/utils/explorer-links';
import { waitForTransaction } from '@/lib/movement-client';
import {
  buildMintRatherTokenTransaction,
  fetchLpTokenBalance,
  fetchRatherTokenBalance,
  fetchStrategyMetrics,
} from '@/lib/strategy/operations';
import { fetchPoolReserves, fromOnChainAmount, toOnChainAmount } from '@/lib/pool/operations';
import { MODULE_ADDRESS } from '@/constants/contracts';

export default function StrategyDashboard() {
  const toast = useToast();
  const currentAddress = useCurrentAddress();
  const { signAndSubmitTransaction, connected } = useWallet();

  const [isMintingRather, setIsMintingRather] = useState(false);

  // Pool reserves
  const { data: poolReserves, isLoading: poolLoading } = useQuery({
    queryKey: ['strategy-pool-reserves'],
    queryFn: () => fetchPoolReserves(),
    refetchInterval: 30000,
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

  // Strategy metrics (e.g., total value locked, burn stats, etc.)
  const { data: strategyMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['strategy-metrics'],
    queryFn: () => fetchStrategyMetrics(),
    refetchInterval: 60000,
  });

  const handleMintRather = useCallback(async () => {
    if (!currentAddress) return;

    setIsMintingRather(true);
    try {
      // Mint 1 RATHER token for testing
      const mintAmount = toOnChainAmount(1);
      const txPayload = buildMintRatherTokenTransaction(currentAddress, mintAmount);
      const response = await signAndSubmitTransaction(txPayload);

      toast({
        title: 'Transaction submitted',
        description: 'Waiting for confirmation...',
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(response.hash);

      toast({
        title: 'RATHER tokens minted!',
        description: (
          <Link href={getExplorerLink(response.hash, 'testnet')} isExternal>
            View on Explorer <ExternalLinkIcon mx="2px" />
          </Link>
        ),
        status: 'success',
        duration: 10000,
      });

      void refetchRather();
    } catch (error: any) {
      toast({
        title: 'Mint failed',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsMintingRather(false);
    }
  }, [currentAddress, signAndSubmitTransaction, toast, refetchRather]);

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Heading size="lg">Strategy Dashboard</Heading>

        {/* User Holdings */}
        <Card>
          <CardHeader>
            <Heading size="md">Your Holdings</Heading>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
              <Stat>
                <StatLabel>RATHER Balance</StatLabel>
                <StatNumber>
                  {ratherLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    fromOnChainAmount(ratherBalance).toLocaleString()
                  )}
                </StatNumber>
                <StatHelpText>RATHER tokens</StatHelpText>
              </Stat>
              <Stat>
                <StatLabel>LP Token Balance</StatLabel>
                <StatNumber>
                  {lpLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    fromOnChainAmount(lpBalance).toLocaleString()
                  )}
                </StatNumber>
                <StatHelpText>Pool share tokens</StatHelpText>
              </Stat>
              <Stat>
                <StatLabel>Pool Position</StatLabel>
                <StatNumber>{poolLoading ? <Spinner size="sm" /> : '—'}</StatNumber>
                <StatHelpText>Estimated value</StatHelpText>
              </Stat>
            </SimpleGrid>
          </CardBody>
        </Card>

        {/* Pool Stats */}
        <Card>
          <CardHeader>
            <Heading size="md">Pool Statistics</Heading>
          </CardHeader>
          <CardBody>
            {poolLoading ? (
              <Center py={4}>
                <Spinner />
              </Center>
            ) : poolReserves ? (
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                <Stat>
                  <StatLabel>RATHER Reserve</StatLabel>
                  <StatNumber>
                    {fromOnChainAmount(poolReserves.reserveX).toLocaleString()}
                  </StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>WMOVE Reserve</StatLabel>
                  <StatNumber>
                    {fromOnChainAmount(poolReserves.reserveY).toLocaleString()}
                  </StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Implied Price</StatLabel>
                  <StatNumber>
                    {poolReserves.reserveX > 0
                      ? (poolReserves.reserveY / poolReserves.reserveX).toFixed(6)
                      : '—'}
                  </StatNumber>
                  <StatHelpText>WMOVE per RATHER</StatHelpText>
                </Stat>
              </SimpleGrid>
            ) : (
              <Text color="gray.500">Pool not initialized</Text>
            )}
          </CardBody>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <Heading size="md">Actions</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text mb={2} fontWeight="medium">
                  Test Mint
                </Text>
                <Text mb={3} fontSize="sm" color="gray.500">
                  Mint 1 RATHER token for testing (testnet only).
                </Text>
                <Button colorScheme="purple" onClick={handleMintRather} isLoading={isMintingRather}>
                  Mint 1 RATHER
                </Button>
              </Box>
            </VStack>
          </CardBody>
        </Card>

        {/* Contract Info */}
        <Card>
          <CardHeader>
            <Heading size="md">Contract Information</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <Text color="gray.500">Module Address</Text>
                <Link
                  href={`https://explorer.testnet.movementinfra.xyz/account/${MODULE_ADDRESS}`}
                  isExternal
                  fontSize="sm"
                >
                  {MODULE_ADDRESS.slice(0, 10)}...{MODULE_ADDRESS.slice(-8)}{' '}
                  <ExternalLinkIcon mx="2px" />
                </Link>
              </HStack>
              <HStack justify="space-between">
                <Text color="gray.500">Network</Text>
                <Badge colorScheme="blue">Testnet</Badge>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
}
