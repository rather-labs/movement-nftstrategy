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
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/lib/wallet-context';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { getExplorerLink, getTransactionExplorerUrl } from '@/utils/explorer-links';
import { addressesEqual } from '@/utils/formatting';
import { MODULE_ADDRESS, TREASURY_ADDRESS } from '@/constants/contracts';
import {
  fetchPoolReserves,
  fromOnChainAmount,
  toOnChainAmount,
  poolExists,
  buildCreatePoolTransaction,
} from '@/lib/pool/operations';
import {
  fetchMarketplaceInfo,
  isMarketplaceInitialized,
  buildInitializeMarketplaceTransaction,
  buildSetFeeBpsTransaction,
  buildSetFeeRecipientTransaction,
  buildSetMarketplaceAdminTransaction,
} from '@/lib/marketplace/operations';
import {
  buildCreateCollectionTransaction,
  buildMintNftTransaction,
  buildMintBatchTransaction,
  collectionExists,
  getCollectionAddress,
  getCollectionInfo,
  CollectionInfo,
} from '@/lib/nft/operations';
import {
  buildMintRatherTokenTransaction,
  buildInitializeStrategyTransaction,
  isStrategyInitialized,
  fetchStrategyTreasuryAddress,
  fetchTreasuryAddressPreview,
} from '@/lib/strategy/operations';
import { waitForTransaction } from '@/lib/movement-client';

export default function AdminUtilitiesPage() {
  const toast = useToast();
  const currentAddress = useCurrentAddress();
  const { signAndSubmitTransaction, connected } = useWallet();

  // Pool state
  const [isCreatingPool, setIsCreatingPool] = useState(false);

  // RATHER token state
  const [isMinting, setIsMinting] = useState(false);
  const [mintAmount, setMintAmount] = useState('');

  // Marketplace state
  const [isInitializingMarketplace, setIsInitializingMarketplace] = useState(false);
  const [marketplaceFeeBps, setMarketplaceFeeBps] = useState('100'); // Default 1%
  const [marketplaceFeeRecipient, setMarketplaceFeeRecipient] = useState('');
  const [isUpdatingFee, setIsUpdatingFee] = useState(false);
  const [newFeeBps, setNewFeeBps] = useState('');
  const [isUpdatingFeeRecipient, setIsUpdatingFeeRecipient] = useState(false);
  const [newFeeRecipient, setNewFeeRecipient] = useState('');
  const [isTransferringAdmin, setIsTransferringAdmin] = useState(false);
  const [newAdminAddress, setNewAdminAddress] = useState('');

  // NFT Collection state
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [collectionDescription, setCollectionDescription] = useState('RatherRobots NFT Collection');
  const [isMintingNft, setIsMintingNft] = useState(false);
  const [nftRecipient, setNftRecipient] = useState('');
  const [isBatchMinting, setIsBatchMinting] = useState(false);
  const [batchRecipient, setBatchRecipient] = useState('');
  const [batchCount, setBatchCount] = useState('1');

  // Strategy state
  const [isInitializingStrategy, setIsInitializingStrategy] = useState(false);

  // Check if current user is the admin
  const isAdmin = useMemo(() => {
    if (!currentAddress || !MODULE_ADDRESS) return false;
    return addressesEqual(currentAddress, MODULE_ADDRESS);
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
  const { data: marketplaceInitialized, refetch: refetchMarketplaceInit } = useQuery({
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

  // Check if collection exists
  const { data: collectionExistsData, refetch: refetchCollectionExists } = useQuery({
    queryKey: ['collection-exists', MODULE_ADDRESS],
    queryFn: () => collectionExists(MODULE_ADDRESS!),
    enabled: connected && !!MODULE_ADDRESS,
  });

  // Fetch collection info if it exists
  const {
    data: collectionInfo,
    isLoading: collectionLoading,
    refetch: refetchCollection,
  } = useQuery({
    queryKey: ['collection-info', MODULE_ADDRESS],
    queryFn: async () => {
      const addr = await getCollectionAddress(MODULE_ADDRESS!);
      return getCollectionInfo(addr);
    },
    enabled: connected && !!MODULE_ADDRESS && collectionExistsData === true,
    refetchInterval: 30000,
  });

  // Check if strategy is initialized
  const { data: strategyInitialized, refetch: refetchStrategyInit } = useQuery({
    queryKey: ['strategy-initialized'],
    queryFn: () => isStrategyInitialized(),
    enabled: connected,
  });

  // Fetch strategy treasury address (if initialized)
  const { data: strategyTreasuryAddress, refetch: refetchStrategyTreasury } = useQuery({
    queryKey: ['strategy-treasury-address'],
    queryFn: () => fetchStrategyTreasuryAddress(),
    enabled: connected && strategyInitialized === true,
  });

  // Preview treasury address (before initialization)
  const { data: treasuryAddressPreview } = useQuery({
    queryKey: ['treasury-address-preview', currentAddress],
    queryFn: () => fetchTreasuryAddressPreview(currentAddress!),
    enabled: connected && !!currentAddress && strategyInitialized === false,
  });

  const refreshAll = useCallback(() => {
    void refetchPool();
    void refetchMarketplace();
    void refetchPoolExists();
    void refetchMarketplaceInit();
    void refetchCollectionExists();
    void refetchCollection();
    void refetchStrategyInit();
    void refetchStrategyTreasury();
  }, [
    refetchPool,
    refetchMarketplace,
    refetchPoolExists,
    refetchMarketplaceInit,
    refetchCollectionExists,
    refetchCollection,
    refetchStrategyInit,
    refetchStrategyTreasury,
  ]);

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
        MODULE_ADDRESS!,
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
      const tx = buildMintRatherTokenTransaction(MODULE_ADDRESS!, amountOnChain);

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

  // Handle initialize marketplace
  const handleInitializeMarketplace = useCallback(async () => {
    if (!currentAddress) {
      toast({ title: 'Connect wallet', status: 'warning' });
      return;
    }

    const feeBps = parseInt(marketplaceFeeBps);
    if (isNaN(feeBps) || feeBps < 0 || feeBps > 1000) {
      toast({
        title: 'Invalid fee',
        description: 'Fee must be between 0 and 1000 BPS (0-10%)',
        status: 'warning',
      });
      return;
    }

    const recipient = marketplaceFeeRecipient || currentAddress;

    setIsInitializingMarketplace(true);
    try {
      const tx = buildInitializeMarketplaceTransaction(feeBps, recipient);
      const result = await signAndSubmitTransaction(tx);
      await waitForTransaction(result.hash);

      toast({
        title: 'Marketplace initialized!',
        description: `Fee: ${feeBps / 100}%, Recipient: ${recipient.slice(0, 10)}...`,
        status: 'success',
        duration: 5000,
      });

      void refetchMarketplaceInit();
      void refetchMarketplace();
    } catch (error: any) {
      console.error('Initialize marketplace error:', error);
      toast({
        title: 'Failed to initialize marketplace',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsInitializingMarketplace(false);
    }
  }, [
    currentAddress,
    marketplaceFeeBps,
    marketplaceFeeRecipient,
    signAndSubmitTransaction,
    toast,
    refetchMarketplaceInit,
    refetchMarketplace,
  ]);

  // Handle update fee BPS
  const handleUpdateFeeBps = useCallback(async () => {
    if (!currentAddress) return;

    const feeBps = parseInt(newFeeBps);
    if (isNaN(feeBps) || feeBps < 0 || feeBps > 1000) {
      toast({
        title: 'Invalid fee',
        description: 'Fee must be between 0 and 1000 BPS (0-10%)',
        status: 'warning',
      });
      return;
    }

    setIsUpdatingFee(true);
    try {
      const tx = buildSetFeeBpsTransaction(feeBps);
      const result = await signAndSubmitTransaction(tx);
      await waitForTransaction(result.hash);

      toast({
        title: 'Fee updated!',
        description: `New fee: ${feeBps / 100}%`,
        status: 'success',
      });

      setNewFeeBps('');
      void refetchMarketplace();
    } catch (error: any) {
      toast({
        title: 'Failed to update fee',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsUpdatingFee(false);
    }
  }, [currentAddress, newFeeBps, signAndSubmitTransaction, toast, refetchMarketplace]);

  // Handle update fee recipient
  const handleUpdateFeeRecipient = useCallback(async () => {
    if (!currentAddress || !newFeeRecipient) return;

    setIsUpdatingFeeRecipient(true);
    try {
      const tx = buildSetFeeRecipientTransaction(newFeeRecipient);
      const result = await signAndSubmitTransaction(tx);
      await waitForTransaction(result.hash);

      toast({
        title: 'Fee recipient updated!',
        description: `New recipient: ${newFeeRecipient.slice(0, 10)}...`,
        status: 'success',
      });

      setNewFeeRecipient('');
      void refetchMarketplace();
    } catch (error: any) {
      toast({
        title: 'Failed to update fee recipient',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsUpdatingFeeRecipient(false);
    }
  }, [currentAddress, newFeeRecipient, signAndSubmitTransaction, toast, refetchMarketplace]);

  // Handle transfer admin
  const handleTransferAdmin = useCallback(async () => {
    if (!currentAddress || !newAdminAddress) return;

    setIsTransferringAdmin(true);
    try {
      const tx = buildSetMarketplaceAdminTransaction(newAdminAddress);
      const result = await signAndSubmitTransaction(tx);
      await waitForTransaction(result.hash);

      toast({
        title: 'Admin transferred!',
        description: `New admin: ${newAdminAddress.slice(0, 10)}...`,
        status: 'success',
      });

      setNewAdminAddress('');
      void refetchMarketplace();
    } catch (error: any) {
      toast({
        title: 'Failed to transfer admin',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsTransferringAdmin(false);
    }
  }, [currentAddress, newAdminAddress, signAndSubmitTransaction, toast, refetchMarketplace]);

  // Handle create collection
  const handleCreateCollection = useCallback(async () => {
    if (!currentAddress) {
      toast({ title: 'Connect wallet', status: 'warning' });
      return;
    }

    setIsCreatingCollection(true);
    try {
      const tx = buildCreateCollectionTransaction(collectionDescription);
      const result = await signAndSubmitTransaction(tx);
      await waitForTransaction(result.hash);

      toast({
        title: 'Collection created!',
        description: 'RatherRobots collection is now live.',
        status: 'success',
        duration: 5000,
      });

      void refetchCollectionExists();
      void refetchCollection();
    } catch (error: any) {
      console.error('Create collection error:', error);
      toast({
        title: 'Failed to create collection',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsCreatingCollection(false);
    }
  }, [
    currentAddress,
    collectionDescription,
    signAndSubmitTransaction,
    toast,
    refetchCollectionExists,
    refetchCollection,
  ]);

  // Handle mint single NFT
  const handleMintNft = useCallback(async () => {
    if (!currentAddress) return;

    const recipient = nftRecipient || currentAddress;

    setIsMintingNft(true);
    try {
      const tx = buildMintNftTransaction(recipient);
      const result = await signAndSubmitTransaction(tx);
      await waitForTransaction(result.hash);

      toast({
        title: 'NFT minted!',
        description: `Minted to ${recipient.slice(0, 10)}...`,
        status: 'success',
      });

      setNftRecipient('');
      void refetchCollection();
    } catch (error: any) {
      toast({
        title: 'Failed to mint NFT',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsMintingNft(false);
    }
  }, [currentAddress, nftRecipient, signAndSubmitTransaction, toast, refetchCollection]);

  // Handle batch mint NFTs
  const handleBatchMint = useCallback(async () => {
    if (!currentAddress) return;

    const count = parseInt(batchCount);
    if (isNaN(count) || count < 1 || count > 30) {
      toast({
        title: 'Invalid count',
        description: 'Batch count must be between 1 and 30',
        status: 'warning',
      });
      return;
    }

    const recipient = batchRecipient || currentAddress;

    setIsBatchMinting(true);
    try {
      const tx = buildMintBatchTransaction(recipient, count);
      const result = await signAndSubmitTransaction(tx);
      await waitForTransaction(result.hash);

      toast({
        title: 'Batch mint successful!',
        description: `Minted ${count} NFTs to ${recipient.slice(0, 10)}...`,
        status: 'success',
      });

      setBatchRecipient('');
      setBatchCount('1');
      void refetchCollection();
    } catch (error: any) {
      toast({
        title: 'Failed to batch mint',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsBatchMinting(false);
    }
  }, [
    currentAddress,
    batchRecipient,
    batchCount,
    signAndSubmitTransaction,
    toast,
    refetchCollection,
  ]);

  // Handle initialize strategy
  const handleInitializeStrategy = useCallback(async () => {
    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet first.',
        status: 'warning',
      });
      return;
    }

    setIsInitializingStrategy(true);
    try {
      const tx = buildInitializeStrategyTransaction();
      const result = await signAndSubmitTransaction(tx);
      const txHash = result.hash;

      toast({
        title: 'Transaction submitted',
        description: `Initializing strategy... TX: ${txHash.slice(0, 10)}...`,
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(txHash);

      toast({
        title: 'Strategy initialized!',
        description: 'The strategy module is now active with a new treasury.',
        status: 'success',
        duration: 5000,
      });

      void refetchStrategyInit();
      void refetchStrategyTreasury();
    } catch (error: any) {
      console.error('Initialize strategy error:', error);
      toast({
        title: 'Failed to initialize strategy',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsInitializingStrategy(false);
    }
  }, [
    currentAddress,
    signAndSubmitTransaction,
    toast,
    refetchStrategyInit,
    refetchStrategyTreasury,
  ]);

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
              Required: {MODULE_ADDRESS?.slice(0, 10)}...
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
                  Tokens will be minted to: {MODULE_ADDRESS?.slice(0, 12)}...
                  {MODULE_ADDRESS?.slice(-8)}
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

        {/* Marketplace Administration */}
        <Card>
          <CardHeader>
            <Heading size="md">Marketplace Administration</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" spacing={6}>
              {/* Status */}
              <VStack align="start" spacing={2}>
                <HStack>
                  <Text fontWeight="bold">Status:</Text>
                  <Badge colorScheme={marketplaceInitialized ? 'green' : 'yellow'}>
                    {marketplaceInitialized ? 'Initialized' : 'Not Initialized'}
                  </Badge>
                </HStack>
                {marketplaceInfo && (
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4} w="full">
                    <Stat size="sm">
                      <StatLabel>Current Fee</StatLabel>
                      <StatNumber>{(marketplaceInfo.feeBps / 100).toFixed(2)}%</StatNumber>
                      <StatHelpText>{marketplaceInfo.feeBps} BPS</StatHelpText>
                    </Stat>
                    <Stat size="sm">
                      <StatLabel>Total Sales</StatLabel>
                      <StatNumber>
                        {fromOnChainAmount(marketplaceInfo.totalSales).toFixed(2)}
                      </StatNumber>
                      <StatHelpText>MOVE</StatHelpText>
                    </Stat>
                  </SimpleGrid>
                )}
              </VStack>

              <Divider />

              {/* Initialize Marketplace */}
              {!marketplaceInitialized && (
                <VStack align="start" spacing={4}>
                  <Text fontWeight="bold">Initialize Marketplace</Text>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w="full">
                    <FormControl>
                      <FormLabel>Fee (BPS)</FormLabel>
                      <NumberInput
                        value={marketplaceFeeBps}
                        onChange={setMarketplaceFeeBps}
                        min={0}
                        max={1000}
                      >
                        <NumberInputField placeholder="100 = 1%" />
                      </NumberInput>
                      <FormHelperText>1% = 100 BPS, max 10% = 1000 BPS</FormHelperText>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Fee Recipient</FormLabel>
                      <Input
                        value={marketplaceFeeRecipient}
                        onChange={(e) => setMarketplaceFeeRecipient(e.target.value)}
                        placeholder={currentAddress || 'Leave empty for your address'}
                      />
                      <FormHelperText>Leave empty to use your address</FormHelperText>
                    </FormControl>
                  </SimpleGrid>
                  <Button
                    colorScheme="blue"
                    onClick={handleInitializeMarketplace}
                    isLoading={isInitializingMarketplace}
                  >
                    Initialize Marketplace
                  </Button>
                </VStack>
              )}

              {/* Update Settings (only if initialized) */}
              {marketplaceInitialized && (
                <VStack align="stretch" spacing={4}>
                  <Text fontWeight="bold">Update Settings</Text>

                  {/* Update Fee */}
                  <HStack spacing={4} align="end">
                    <FormControl flex={1}>
                      <FormLabel>New Fee (BPS)</FormLabel>
                      <NumberInput value={newFeeBps} onChange={setNewFeeBps} min={0} max={1000}>
                        <NumberInputField placeholder="100 = 1%" />
                      </NumberInput>
                    </FormControl>
                    <Button
                      colorScheme="blue"
                      onClick={handleUpdateFeeBps}
                      isLoading={isUpdatingFee}
                      isDisabled={!newFeeBps}
                    >
                      Update Fee
                    </Button>
                  </HStack>

                  {/* Update Fee Recipient */}
                  <HStack spacing={4} align="end">
                    <FormControl flex={1}>
                      <FormLabel>New Fee Recipient</FormLabel>
                      <Input
                        value={newFeeRecipient}
                        onChange={(e) => setNewFeeRecipient(e.target.value)}
                        placeholder="0x..."
                      />
                    </FormControl>
                    <Button
                      colorScheme="blue"
                      onClick={handleUpdateFeeRecipient}
                      isLoading={isUpdatingFeeRecipient}
                      isDisabled={!newFeeRecipient}
                    >
                      Update Recipient
                    </Button>
                  </HStack>

                  {/* Transfer Admin */}
                  <HStack spacing={4} align="end">
                    <FormControl flex={1}>
                      <FormLabel>Transfer Admin To</FormLabel>
                      <Input
                        value={newAdminAddress}
                        onChange={(e) => setNewAdminAddress(e.target.value)}
                        placeholder="0x..."
                      />
                    </FormControl>
                    <Button
                      colorScheme="red"
                      variant="outline"
                      onClick={handleTransferAdmin}
                      isLoading={isTransferringAdmin}
                      isDisabled={!newAdminAddress}
                    >
                      Transfer Admin
                    </Button>
                  </HStack>
                </VStack>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* NFT Collection Administration */}
        <Card>
          <CardHeader>
            <Heading size="md">NFT Collection Administration</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" spacing={6}>
              {/* Collection Status */}
              <VStack align="start" spacing={2}>
                <HStack>
                  <Text fontWeight="bold">Collection Status:</Text>
                  <Badge colorScheme={collectionExistsData ? 'green' : 'yellow'}>
                    {collectionExistsData ? 'Created' : 'Not Created'}
                  </Badge>
                </HStack>
                {collectionInfo && (
                  <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} w="full">
                    <Stat size="sm">
                      <StatLabel>Name</StatLabel>
                      <StatNumber fontSize="lg">{collectionInfo.name}</StatNumber>
                    </Stat>
                    <Stat size="sm">
                      <StatLabel>Current Supply</StatLabel>
                      <StatNumber>{collectionInfo.currentSupply.toLocaleString()}</StatNumber>
                      <StatHelpText>of {collectionInfo.maxSupply.toLocaleString()}</StatHelpText>
                    </Stat>
                    <Stat size="sm">
                      <StatLabel>Available</StatLabel>
                      <StatNumber>
                        {(collectionInfo.maxSupply - collectionInfo.currentSupply).toLocaleString()}
                      </StatNumber>
                      <StatHelpText>NFTs remaining</StatHelpText>
                    </Stat>
                  </SimpleGrid>
                )}
              </VStack>

              <Divider />

              {/* Create Collection */}
              {!collectionExistsData && (
                <VStack align="start" spacing={4}>
                  <Text fontWeight="bold">Create Collection</Text>
                  <FormControl>
                    <FormLabel>Description</FormLabel>
                    <Input
                      value={collectionDescription}
                      onChange={(e) => setCollectionDescription(e.target.value)}
                      placeholder="Collection description"
                    />
                    <FormHelperText>
                      Collection name is &quot;RatherRobots&quot; with max supply of 10,000
                    </FormHelperText>
                  </FormControl>
                  <Button
                    colorScheme="purple"
                    onClick={handleCreateCollection}
                    isLoading={isCreatingCollection}
                  >
                    Create Collection
                  </Button>
                </VStack>
              )}

              {/* Mint NFTs (only if collection exists) */}
              {collectionExistsData && (
                <VStack align="stretch" spacing={4}>
                  <Text fontWeight="bold">Mint NFTs</Text>

                  {/* Single Mint */}
                  <HStack spacing={4} align="end">
                    <FormControl flex={1}>
                      <FormLabel>Mint Single NFT</FormLabel>
                      <Input
                        value={nftRecipient}
                        onChange={(e) => setNftRecipient(e.target.value)}
                        placeholder={currentAddress || 'Recipient address (leave empty for self)'}
                      />
                    </FormControl>
                    <Button colorScheme="purple" onClick={handleMintNft} isLoading={isMintingNft}>
                      Mint 1 NFT
                    </Button>
                  </HStack>

                  <Divider />

                  {/* Batch Mint */}
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Batch Recipient</FormLabel>
                      <Input
                        value={batchRecipient}
                        onChange={(e) => setBatchRecipient(e.target.value)}
                        placeholder={currentAddress || 'Leave empty for self'}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Count (1-30)</FormLabel>
                      <NumberInput value={batchCount} onChange={setBatchCount} min={1} max={30}>
                        <NumberInputField />
                      </NumberInput>
                    </FormControl>
                  </SimpleGrid>
                  <Button
                    colorScheme="purple"
                    onClick={handleBatchMint}
                    isLoading={isBatchMinting}
                    isDisabled={parseInt(batchCount) < 1 || parseInt(batchCount) > 30}
                  >
                    Batch Mint {batchCount} NFT{parseInt(batchCount) !== 1 ? 's' : ''}
                  </Button>
                </VStack>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Strategy Module */}
        <Card>
          <CardHeader>
            <HStack justify="space-between">
              <Heading size="md">Strategy Module</Heading>
              <Badge colorScheme={strategyInitialized ? 'green' : 'yellow'}>
                {strategyInitialized ? 'Initialized' : 'Not Initialized'}
              </Badge>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack align="start" spacing={4}>
              <Text fontSize="sm" color="gray.600">
                The Strategy module enables automated floor buying and relisting of NFTs. When
                initialized, it creates a treasury object that can hold WMOVE and execute buy/relist
                actions on behalf of the protocol.
              </Text>

              {strategyInitialized ? (
                <VStack align="start" spacing={3} w="100%">
                  <Stat>
                    <StatLabel>Treasury Address</StatLabel>
                    <StatNumber fontSize="md" fontFamily="mono">
                      {strategyTreasuryAddress?.slice(0, 16)}...{strategyTreasuryAddress?.slice(-8)}
                    </StatNumber>
                    <StatHelpText>
                      This is where WMOVE is held for floor buying operations.
                    </StatHelpText>
                  </Stat>
                  <Link
                    href={`https://explorer.movementnetwork.xyz/account/${strategyTreasuryAddress}?network=testnet`}
                    isExternal
                    color="blue.500"
                    fontSize="sm"
                  >
                    View Treasury on Explorer <ExternalLinkIcon mx="2px" />
                  </Link>
                </VStack>
              ) : (
                <VStack align="start" spacing={4} w="100%">
                  <VStack align="start" spacing={1}>
                    <Text fontWeight="bold" fontSize="sm">
                      Preview Treasury Address:
                    </Text>
                    <Text fontSize="sm" fontFamily="mono" color="gray.600">
                      {treasuryAddressPreview ? (
                        <>
                          {treasuryAddressPreview.slice(0, 20)}...
                          {treasuryAddressPreview.slice(-12)}
                        </>
                      ) : (
                        'Computing...'
                      )}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      This address is deterministic based on your admin address.
                    </Text>
                  </VStack>
                  <Divider />
                  <Button
                    colorScheme="green"
                    onClick={handleInitializeStrategy}
                    isLoading={isInitializingStrategy}
                  >
                    Initialize Strategy
                  </Button>
                  <Text fontSize="xs" color="gray.500">
                    Note: Once initialized, the treasury address cannot be changed.
                  </Text>
                </VStack>
              )}
            </VStack>
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
                  {MODULE_ADDRESS?.slice(0, 20)}...
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
