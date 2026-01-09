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
import { MODULE_ADDRESS, TREASURY_ADDRESS } from '@/constants/contracts';
import {
  fetchPoolReserves,
  fromOnChainAmount,
  toOnChainAmount,
  poolExists,
  buildCreatePoolTransaction,
} from '@/lib/pool/operations';
import { fetchMarketplaceInfo, isMarketplaceInitialized } from '@/lib/marketplace/operations';
import { buildMintRatherTokenTransaction } from '@/lib/strategy/operations';
import { waitForTransaction } from '@/lib/movement-client';

export default function AdminUtilitiesPage() {
  const toast = useToast();
  const currentAddress = useCurrentAddress();
  const { signAndSubmitTransaction, connected } = useWallet();

  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingPool, setIsCreatingPool] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintAmount, setMintAmount] = useState('');

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

  // Check if pool exists
  const { data: poolExistsData, refetch: refetchPoolExists } = useQuery({
    queryKey: ['pool-exists'],
    queryFn: () => poolExists(),
    enabled: connected,
  });

  const refreshAll = useCallback(() => {
    void refetchPool();
    void refetchMarketplace();
    void refetchPoolExists();
  }, [refetchPool, refetchMarketplace, refetchPoolExists]);

  // Handle create pool
  const handleCreatePool = useCallback(async () => {
    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet first.',
        status: 'warning',
      });
      return;
    }

    setIsCreatingPool(true);
    try {
      // Create pool with:
      // - Admin: MODULE_ADDRESS (deployer)
      // - Fee Recipient: TREASURY_ADDRESS
      // - Fee BPS: 500 (5.00%)
      // - Fee Token: 1 (WMOVE)
      const tx = buildCreatePoolTransaction(
        MODULE_ADDRESS,
        TREASURY_ADDRESS,
        500, // 5.00% fee
        1 // Collect fee in Y (WMOVE)
      );

      const result = await signAndSubmitTransaction(tx);
      const txHash = result.hash;

      toast({
        title: 'Transaction submitted',
        description: `Creating pool... TX: ${txHash.slice(0, 10)}...`,
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(txHash);

      toast({
        title: 'Pool created successfully!',
        description: 'RatherToken/WMOVE pool is now live.',
        status: 'success',
        duration: 5000,
      });

      void refetchPoolExists();
      void refetchPool();
    } catch (error: any) {
      console.error('Create pool error:', error);
      toast({
        title: 'Failed to create pool',
        description: error.message || 'Transaction failed',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsCreatingPool(false);
    }
  }, [currentAddress, signAndSubmitTransaction, toast, refetchPoolExists, refetchPool]);

  // Handle mint RATHER tokens
  const handleMintRather = useCallback(async () => {
    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet first.',
        status: 'warning',
      });
      return;
    }

    const parsedAmount = parseFloat(mintAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount to mint.',
        status: 'warning',
      });
      return;
    }

    setIsMinting(true);
    try {
      const amountOnChain = toOnChainAmount(parsedAmount);
      const tx = buildMintRatherTokenTransaction(MODULE_ADDRESS, amountOnChain);

      const result = await signAndSubmitTransaction(tx);
      const txHash = result.hash;

      toast({
        title: 'Transaction submitted',
        description: `Minting ${parsedAmount} RATHER tokens...`,
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(txHash);

      toast({
        title: 'Tokens minted successfully!',
        description: `${parsedAmount} RATHER tokens minted to admin address.`,
        status: 'success',
        duration: 5000,
      });

      setMintAmount('');
    } catch (error: any) {
      console.error('Mint error:', error);
      toast({
        title: 'Failed to mint tokens',
        description: error.message || 'Transaction failed',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsMinting(false);
    }
  }, [currentAddress, mintAmount, signAndSubmitTransaction, toast]);

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

        {/* Create Pool Section */}
        <Card>
          <CardHeader>
            <Heading size="md">Create Liquidity Pool</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="start" spacing={4}>
              <Text fontSize="sm" color="gray.600">
                Create a new RatherToken/WMOVE liquidity pool with the following configuration:
              </Text>
              <VStack align="start" spacing={1}>
                <HStack>
                  <Text fontWeight="bold" fontSize="sm">
                    Token X:
                  </Text>
                  <Text fontSize="sm">RatherToken</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="bold" fontSize="sm">
                    Token Y:
                  </Text>
                  <Text fontSize="sm">WMOVE</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="bold" fontSize="sm">
                    Fee:
                  </Text>
                  <Text fontSize="sm">5% (500 bps)</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="bold" fontSize="sm">
                    Fee Token:
                  </Text>
                  <Text fontSize="sm">WMOVE (fees collected in WMOVE)</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="bold" fontSize="sm">
                    Fee Recipient:
                  </Text>
                  <Text fontSize="sm" fontFamily="mono">
                    {TREASURY_ADDRESS.slice(0, 12)}...{TREASURY_ADDRESS.slice(-8)}
                  </Text>
                </HStack>
              </VStack>
              <Divider />
              <HStack spacing={4}>
                <Button
                  colorScheme="purple"
                  onClick={handleCreatePool}
                  isLoading={isCreatingPool}
                  isDisabled={poolExistsData === true}
                >
                  Create Pool
                </Button>
                {poolExistsData === true && (
                  <Badge colorScheme="green" fontSize="sm">
                    Pool Already Exists
                  </Badge>
                )}
                {poolExistsData === false && (
                  <Badge colorScheme="yellow" fontSize="sm">
                    Pool Not Created
                  </Badge>
                )}
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {/* Mint RATHER Token Section */}
        <Card>
          <CardHeader>
            <Heading size="md">Mint RATHER Tokens</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="start" spacing={4}>
              <Text fontSize="sm" color="gray.600">
                Mint new RATHER tokens to the admin address. Only the contract admin can mint
                tokens.
              </Text>
              <FormControl>
                <FormLabel>Amount to Mint</FormLabel>
                <NumberInput
                  value={mintAmount}
                  onChange={(value) => setMintAmount(value)}
                  min={0}
                  precision={8}
                >
                  <NumberInputField placeholder="Enter amount (e.g., 1000)" />
                </NumberInput>
                <FormHelperText>
                  Tokens will be minted to: {MODULE_ADDRESS.slice(0, 12)}...
                  {MODULE_ADDRESS.slice(-8)}
                </FormHelperText>
              </FormControl>
              <Button
                colorScheme="green"
                onClick={handleMintRather}
                isLoading={isMinting}
                isDisabled={!mintAmount || parseFloat(mintAmount) <= 0}
              >
                Mint RATHER
              </Button>
            </VStack>
          </CardBody>
        </Card>

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
