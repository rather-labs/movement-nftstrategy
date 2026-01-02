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
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Link,
  NumberInput,
  NumberInputField,
  Spinner,
  Stack,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/lib/wallet-context';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { getExplorerLink, getTransactionExplorerUrl } from '@/utils/explorer-links';
import { MODULE_ADDRESS } from '@/constants/contracts';
import { fetchPoolReserves, fromOnChainAmount } from '@/lib/pool/operations';
import { fetchMarketplaceInfo, isMarketplaceInitialized } from '@/lib/marketplace/operations';
import { waitForTransaction } from '@/lib/movement-client';

export default function AdminUtilitiesPage() {
  const toast = useToast();
  const currentAddress = useCurrentAddress();
  const { signAndSubmitTransaction, connected } = useWallet();

  const [isLoading, setIsLoading] = useState(false);

  // Check if current user is the admin
  const isAdmin = useMemo(() => {
    if (!currentAddress) return false;
    return currentAddress.toLowerCase() === MODULE_ADDRESS.toLowerCase();
  }, [currentAddress]);

  // Fetch pool reserves
  const {
    data: poolReserves,
    isLoading: poolLoading,
    refetch: refetchPool,
  } = useQuery({
    queryKey: ['admin-pool-reserves'],
    queryFn: () => fetchPoolReserves(),
    enabled: connected,
    refetchInterval: 30000,
  });

  // Fetch marketplace info
  const {
    data: marketplaceInfo,
    isLoading: marketplaceLoading,
    refetch: refetchMarketplace,
  } = useQuery({
    queryKey: ['admin-marketplace-info'],
    queryFn: () => fetchMarketplaceInfo(),
    enabled: connected,
    refetchInterval: 30000,
  });

  // Check marketplace initialization
  const { data: marketplaceInitialized } = useQuery({
    queryKey: ['marketplace-initialized'],
    queryFn: () => isMarketplaceInitialized(),
    enabled: connected,
  });

  const refreshAll = useCallback(() => {
    void refetchPool();
    void refetchMarketplace();
  }, [refetchPool, refetchMarketplace]);

  if (!connected) {
    return (
      <Container maxW="container.md" py={10}>
        <Center>
          <VStack spacing={4}>
            <Heading size="lg">Admin Utilities</Heading>
            <Text color="gray.500">Please connect your wallet to access admin functions.</Text>
          </VStack>
        </Center>
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container maxW="container.md" py={10}>
        <Center>
          <VStack spacing={4}>
            <Heading size="lg">Admin Utilities</Heading>
            <Text color="red.500">
              Access denied. Only the contract deployer can access admin functions.
            </Text>
            <Text fontSize="sm" color="gray.500">
              Connected: {currentAddress?.slice(0, 10)}...
            </Text>
            <Text fontSize="sm" color="gray.500">
              Required: {MODULE_ADDRESS.slice(0, 10)}...
            </Text>
          </VStack>
        </Center>
      </Container>
    );
  }

  return (
    <Container maxW="container.lg" py={10}>
      <VStack spacing={8} align="stretch">
        <HStack justify="space-between">
          <Heading size="lg">Admin Utilities</Heading>
          <Button onClick={refreshAll} size="sm" variant="outline">
            Refresh All
          </Button>
        </HStack>

        {/* Pool Status */}
        <Card>
          <CardHeader>
            <Heading size="md">Liquidity Pool Status</Heading>
          </CardHeader>
          <CardBody>
            {poolLoading ? (
              <Center py={4}>
                <Spinner />
              </Center>
            ) : poolReserves ? (
              <VStack align="start" spacing={2}>
                <HStack>
                  <Text fontWeight="bold">RATHER Reserve:</Text>
                  <Text>{fromOnChainAmount(poolReserves.reserveX).toLocaleString()}</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="bold">WMOVE Reserve:</Text>
                  <Text>{fromOnChainAmount(poolReserves.reserveY).toLocaleString()}</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="bold">Last Update:</Text>
                  <Text>
                    {poolReserves.lastBlockTimestamp > 0
                      ? new Date(poolReserves.lastBlockTimestamp * 1000).toLocaleString()
                      : 'N/A'}
                  </Text>
                </HStack>
              </VStack>
            ) : (
              <Text color="gray.500">No pool data available</Text>
            )}
          </CardBody>
        </Card>

        {/* Marketplace Status */}
        <Card>
          <CardHeader>
            <Heading size="md">Marketplace Status</Heading>
          </CardHeader>
          <CardBody>
            {marketplaceLoading ? (
              <Center py={4}>
                <Spinner />
              </Center>
            ) : (
              <VStack align="start" spacing={2}>
                <HStack>
                  <Text fontWeight="bold">Initialized:</Text>
                  <Badge colorScheme={marketplaceInitialized ? 'green' : 'red'}>
                    {marketplaceInitialized ? 'Yes' : 'No'}
                  </Badge>
                </HStack>
                {marketplaceInfo && (
                  <>
                    <HStack>
                      <Text fontWeight="bold">Fee (BPS):</Text>
                      <Text>{marketplaceInfo.feeBps}</Text>
                    </HStack>
                    <HStack>
                      <Text fontWeight="bold">Fee Recipient:</Text>
                      <Text fontSize="sm" fontFamily="mono">
                        {marketplaceInfo.feeRecipient.slice(0, 12)}...
                      </Text>
                    </HStack>
                    <HStack>
                      <Text fontWeight="bold">Total Sales:</Text>
                      <Text>{marketplaceInfo.totalSales}</Text>
                    </HStack>
                  </>
                )}
              </VStack>
            )}
          </CardBody>
        </Card>

        {/* Contract Info */}
        <Card>
          <CardHeader>
            <Heading size="md">Contract Information</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="start" spacing={2}>
              <HStack>
                <Text fontWeight="bold">Module Address:</Text>
                <Text fontSize="sm" fontFamily="mono">
                  {MODULE_ADDRESS.slice(0, 20)}...
                </Text>
              </HStack>
              <Link
                href={`https://explorer.movementnetwork.xyz/account/${MODULE_ADDRESS}?network=testnet`}
                isExternal
                color="blue.500"
              >
                View on Explorer <ExternalLinkIcon mx="2px" />
              </Link>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
}
