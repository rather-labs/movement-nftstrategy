'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardHeader,
  Container,
  FormControl,
  FormLabel,
  FormHelperText,
  Heading,
  HStack,
  Link,
  NumberInput,
  NumberInputField,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast,
  Center,
  VStack,
} from '@chakra-ui/react';
import { ExternalLinkIcon, ArrowForwardIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/lib/wallet-context';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { getExplorerLink } from '@/utils/explorer-links';
import {
  fetchPoolReserves,
  quoteRatherToWmove,
  quoteWmoveToRather,
  buildSwapRatherToWmoveTransaction,
  buildSwapWmoveToRatherTransaction,
  buildWrapMoveTransaction,
  buildUnwrapMoveTransaction,
  buildAddLiquidityTransaction,
  buildRemoveLiquidityTransaction,
  toOnChainAmount,
  fromOnChainAmount,
  poolExists,
} from '@/lib/pool/operations';
import {
  fetchLpTokenBalance,
  fetchWmoveBalance,
  fetchRatherTokenBalance,
} from '@/lib/strategy/operations';
import { waitForTransaction, fetchNativeMoveBalance } from '@/lib/movement-client';

type SwapDirection = 'wmove-to-rather' | 'rather-to-wmove';

const DECIMALS = 8;

export default function LiquidityPage() {
  const toast = useToast();
  const currentAddress = useCurrentAddress();
  const { signAndSubmitTransaction, connected } = useWallet();

  // Swap state
  const [swapDirection, setSwapDirection] = useState<SwapDirection>('wmove-to-rather');
  const [swapAmount, setSwapAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);

  // Liquidity state
  const [addAmountRather, setAddAmountRather] = useState('');
  const [addAmountWmove, setAddAmountWmove] = useState('');
  const [lastEditedField, setLastEditedField] = useState<'rather' | 'wmove' | null>(null);
  const [removeAmount, setRemoveAmount] = useState('');
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  const [isRemovingLiquidity, setIsRemovingLiquidity] = useState(false);

  // Wrap/Unwrap state
  const [wrapDirection, setWrapDirection] = useState<'wrap' | 'unwrap'>('wrap');
  const [wrapUnwrapAmount, setWrapUnwrapAmount] = useState('');
  const [isWrapping, setIsWrapping] = useState(false);
  const [isUnwrapping, setIsUnwrapping] = useState(false);

  const {
    data: poolReserves,
    isLoading: poolLoading,
    refetch: refetchPool,
  } = useQuery({
    queryKey: ['liquidity-pool-reserves'],
    queryFn: () => fetchPoolReserves(),
    refetchInterval: 20000,
  });

  const { data: isPoolInitialized } = useQuery({
    queryKey: ['pool-exists'],
    queryFn: () => poolExists(),
  });

  // Fetch user's LP token balance
  const {
    data: lpBalance = 0,
    isLoading: lpBalanceLoading,
    refetch: refetchLpBalance,
  } = useQuery({
    queryKey: ['lp-balance', currentAddress],
    queryFn: () => fetchLpTokenBalance(currentAddress!),
    enabled: !!currentAddress,
    refetchInterval: 15000,
  });

  // Fetch user's WMOVE balance
  const {
    data: wmoveBalance = 0,
    isLoading: wmoveBalanceLoading,
    refetch: refetchWmoveBalance,
  } = useQuery({
    queryKey: ['wmove-balance', currentAddress],
    queryFn: () => fetchWmoveBalance(currentAddress!),
    enabled: !!currentAddress,
    refetchInterval: 15000,
  });

  // Fetch user's native MOVE balance
  const {
    data: moveBalance = 0,
    isLoading: moveBalanceLoading,
    refetch: refetchMoveBalance,
  } = useQuery({
    queryKey: ['move-balance', currentAddress],
    queryFn: () => fetchNativeMoveBalance(currentAddress!),
    enabled: !!currentAddress,
    refetchInterval: 15000,
  });

  // Fetch user's RATHER balance
  const {
    data: ratherBalance = 0,
    isLoading: ratherBalanceLoading,
    refetch: refetchRatherBalance,
  } = useQuery({
    queryKey: ['rather-balance', currentAddress],
    queryFn: () => fetchRatherTokenBalance(currentAddress!),
    enabled: !!currentAddress,
    refetchInterval: 15000,
  });

  const lpBalanceDisplay = fromOnChainAmount(lpBalance);
  const wmoveBalanceDisplay = fromOnChainAmount(wmoveBalance);
  const moveBalanceDisplay = fromOnChainAmount(moveBalance);
  const ratherBalanceDisplay = fromOnChainAmount(ratherBalance);

  // Calculate price ratio from pool reserves
  const priceRatio = useMemo(() => {
    if (!poolReserves || poolReserves.reserveX === 0 || poolReserves.reserveY === 0) {
      return null;
    }
    // Price of 1 RATHER in terms of WMOVE = reserveY / reserveX
    return poolReserves.reserveY / poolReserves.reserveX;
  }, [poolReserves]);

  // Auto-balance handlers for liquidity inputs
  const handleRatherAmountChange = useCallback(
    (value: string) => {
      setAddAmountRather(value);
      setLastEditedField('rather');

      // Auto-calculate WMOVE amount based on pool ratio
      if (priceRatio !== null) {
        const parsedRather = parseFloat(value);
        if (!isNaN(parsedRather) && parsedRather > 0) {
          const wmoveAmount = parsedRather * priceRatio;
          setAddAmountWmove(wmoveAmount.toFixed(8));
        } else {
          setAddAmountWmove('');
        }
      }
    },
    [priceRatio]
  );

  const handleWmoveAmountChange = useCallback(
    (value: string) => {
      setAddAmountWmove(value);
      setLastEditedField('wmove');

      // Auto-calculate RATHER amount based on pool ratio
      if (priceRatio !== null && priceRatio > 0) {
        const parsedWmove = parseFloat(value);
        if (!isNaN(parsedWmove) && parsedWmove > 0) {
          const ratherAmount = parsedWmove / priceRatio;
          setAddAmountRather(ratherAmount.toFixed(8));
        } else {
          setAddAmountRather('');
        }
      }
    },
    [priceRatio]
  );

  const amountIn = useMemo(() => {
    const parsed = parseFloat(swapAmount);
    return isNaN(parsed) || parsed <= 0 ? 0 : toOnChainAmount(parsed);
  }, [swapAmount]);

  const { data: quote = 0, isLoading: quoteLoading } = useQuery({
    queryKey: ['liquidity-pool-quote', swapDirection, amountIn],
    queryFn: async () => {
      if (amountIn <= 0) return 0;
      return swapDirection === 'wmove-to-rather'
        ? quoteWmoveToRather(amountIn)
        : quoteRatherToWmove(amountIn);
    },
    enabled: amountIn > 0,
    refetchInterval: 10000,
  });

  const inputTokenLabel = swapDirection === 'wmove-to-rather' ? 'WMOVE' : 'RATHER';
  const outputTokenLabel = swapDirection === 'wmove-to-rather' ? 'RATHER' : 'WMOVE';
  const estimatedOutput = fromOnChainAmount(quote);
  const swapButtonLabel =
    swapDirection === 'wmove-to-rather' ? 'Swap WMOVE for RATHER' : 'Swap RATHER for WMOVE';
  const isSwapDisabled =
    !currentAddress || !isPoolInitialized || amountIn <= 0 || quote <= 0 || isSwapping;

  const handleDirectionChange = useCallback((direction: SwapDirection) => {
    setSwapDirection(direction);
    setSwapAmount('');
  }, []);

  const handleSwap = useCallback(async () => {
    if (!currentAddress || amountIn <= 0) return;

    setIsSwapping(true);
    try {
      // Calculate minimum output with 1% slippage
      const minAmountOut = Math.floor(quote * 0.99);

      const txPayload =
        swapDirection === 'wmove-to-rather'
          ? buildSwapWmoveToRatherTransaction(amountIn, minAmountOut)
          : buildSwapRatherToWmoveTransaction(amountIn, minAmountOut);

      const response = await signAndSubmitTransaction(txPayload);
      setPendingTxHash(response.hash);

      toast({
        title: 'Transaction submitted',
        description: 'Waiting for confirmation...',
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(response.hash);

      toast({
        title: 'Swap successful!',
        description: (
          <Link href={getExplorerLink(response.hash, 'testnet')} isExternal>
            View on Explorer <ExternalLinkIcon mx="2px" />
          </Link>
        ),
        status: 'success',
        duration: 10000,
      });

      setSwapAmount('');
      void refetchPool();
    } catch (error: any) {
      toast({
        title: 'Swap failed',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsSwapping(false);
      setPendingTxHash(null);
    }
  }, [
    currentAddress,
    amountIn,
    quote,
    swapDirection,
    signAndSubmitTransaction,
    toast,
    refetchPool,
  ]);

  // Computed values for liquidity
  const addAmountRatherOnChain = useMemo(() => {
    const parsed = parseFloat(addAmountRather);
    return isNaN(parsed) || parsed <= 0 ? 0 : toOnChainAmount(parsed);
  }, [addAmountRather]);

  const addAmountWmoveOnChain = useMemo(() => {
    const parsed = parseFloat(addAmountWmove);
    return isNaN(parsed) || parsed <= 0 ? 0 : toOnChainAmount(parsed);
  }, [addAmountWmove]);

  const removeAmountOnChain = useMemo(() => {
    const parsed = parseFloat(removeAmount);
    return isNaN(parsed) || parsed <= 0 ? 0 : toOnChainAmount(parsed);
  }, [removeAmount]);

  const isAddLiquidityDisabled =
    !currentAddress ||
    !isPoolInitialized ||
    addAmountRatherOnChain <= 0 ||
    addAmountWmoveOnChain <= 0 ||
    isAddingLiquidity;

  const isRemoveLiquidityDisabled =
    !currentAddress ||
    !isPoolInitialized ||
    removeAmountOnChain <= 0 ||
    removeAmountOnChain > lpBalance ||
    isRemovingLiquidity;

  const handleAddLiquidity = useCallback(async () => {
    if (!currentAddress || addAmountRatherOnChain <= 0 || addAmountWmoveOnChain <= 0) return;

    setIsAddingLiquidity(true);
    try {
      const txPayload = buildAddLiquidityTransaction(addAmountRatherOnChain, addAmountWmoveOnChain);
      const response = await signAndSubmitTransaction(txPayload);

      toast({
        title: 'Transaction submitted',
        description: 'Adding liquidity...',
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(response.hash);

      toast({
        title: 'Liquidity added successfully!',
        description: (
          <Link href={getExplorerLink(response.hash, 'testnet')} isExternal>
            View on Explorer <ExternalLinkIcon mx="2px" />
          </Link>
        ),
        status: 'success',
        duration: 10000,
      });

      setAddAmountRather('');
      setAddAmountWmove('');
      void refetchPool();
      void refetchLpBalance();
    } catch (error: any) {
      toast({
        title: 'Add liquidity failed',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsAddingLiquidity(false);
    }
  }, [
    currentAddress,
    addAmountRatherOnChain,
    addAmountWmoveOnChain,
    signAndSubmitTransaction,
    toast,
    refetchPool,
    refetchLpBalance,
  ]);

  const handleRemoveLiquidity = useCallback(async () => {
    if (!currentAddress || removeAmountOnChain <= 0) return;

    if (removeAmountOnChain > lpBalance) {
      toast({
        title: 'Insufficient LP tokens',
        description: `You only have ${lpBalanceDisplay.toFixed(8)} LP tokens`,
        status: 'warning',
      });
      return;
    }

    setIsRemovingLiquidity(true);
    try {
      const txPayload = buildRemoveLiquidityTransaction(removeAmountOnChain);
      const response = await signAndSubmitTransaction(txPayload);

      toast({
        title: 'Transaction submitted',
        description: 'Removing liquidity...',
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(response.hash);

      toast({
        title: 'Liquidity removed successfully!',
        description: (
          <Link href={getExplorerLink(response.hash, 'testnet')} isExternal>
            View on Explorer <ExternalLinkIcon mx="2px" />
          </Link>
        ),
        status: 'success',
        duration: 10000,
      });

      setRemoveAmount('');
      void refetchPool();
      void refetchLpBalance();
    } catch (error: any) {
      toast({
        title: 'Remove liquidity failed',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsRemovingLiquidity(false);
    }
  }, [
    currentAddress,
    removeAmountOnChain,
    lpBalance,
    lpBalanceDisplay,
    signAndSubmitTransaction,
    toast,
    refetchPool,
    refetchLpBalance,
  ]);

  const handleMaxRemove = useCallback(() => {
    setRemoveAmount(lpBalanceDisplay.toString());
  }, [lpBalanceDisplay]);

  // Handle wrap direction change
  const handleWrapDirectionChange = useCallback((direction: 'wrap' | 'unwrap') => {
    setWrapDirection(direction);
    setWrapUnwrapAmount('');
  }, []);

  // Wrap MOVE to WMOVE
  const handleWrap = useCallback(async () => {
    if (!currentAddress) return;

    const parsedAmount = parseFloat(wrapUnwrapAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount to wrap.',
        status: 'warning',
      });
      return;
    }

    setIsWrapping(true);
    try {
      const amountOnChain = toOnChainAmount(parsedAmount);
      const txPayload = buildWrapMoveTransaction(amountOnChain);
      const response = await signAndSubmitTransaction(txPayload);

      toast({
        title: 'Transaction submitted',
        description: 'Wrapping MOVE to WMOVE...',
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(response.hash);

      toast({
        title: 'Wrap successful!',
        description: (
          <Link href={getExplorerLink(response.hash, 'testnet')} isExternal>
            View on Explorer <ExternalLinkIcon mx="2px" />
          </Link>
        ),
        status: 'success',
        duration: 10000,
      });

      setWrapUnwrapAmount('');
      void refetchMoveBalance();
      void refetchWmoveBalance();
    } catch (error: any) {
      toast({
        title: 'Wrap failed',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsWrapping(false);
    }
  }, [
    currentAddress,
    wrapUnwrapAmount,
    signAndSubmitTransaction,
    toast,
    refetchMoveBalance,
    refetchWmoveBalance,
  ]);

  // Unwrap WMOVE to MOVE
  const handleUnwrap = useCallback(async () => {
    if (!currentAddress) return;

    const parsedAmount = parseFloat(wrapUnwrapAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount to unwrap.',
        status: 'warning',
      });
      return;
    }

    setIsUnwrapping(true);
    try {
      const amountOnChain = toOnChainAmount(parsedAmount);
      const txPayload = buildUnwrapMoveTransaction(amountOnChain);
      const response = await signAndSubmitTransaction(txPayload);

      toast({
        title: 'Transaction submitted',
        description: 'Unwrapping WMOVE to MOVE...',
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(response.hash);

      toast({
        title: 'Unwrap successful!',
        description: (
          <Link href={getExplorerLink(response.hash, 'testnet')} isExternal>
            View on Explorer <ExternalLinkIcon mx="2px" />
          </Link>
        ),
        status: 'success',
        duration: 10000,
      });

      setWrapUnwrapAmount('');
      void refetchMoveBalance();
      void refetchWmoveBalance();
    } catch (error: any) {
      toast({
        title: 'Unwrap failed',
        description: error.message || 'Transaction failed',
        status: 'error',
      });
    } finally {
      setIsUnwrapping(false);
    }
  }, [
    currentAddress,
    wrapUnwrapAmount,
    signAndSubmitTransaction,
    toast,
    refetchMoveBalance,
    refetchWmoveBalance,
  ]);

  // MAX handler for wrap/unwrap
  const handleMaxWrapUnwrap = useCallback(() => {
    if (wrapDirection === 'wrap') {
      // Leave a small buffer for gas fees (0.1 MOVE)
      const maxAmount = Math.max(0, moveBalanceDisplay - 0.1);
      setWrapUnwrapAmount(maxAmount > 0 ? maxAmount.toFixed(8) : '');
    } else {
      setWrapUnwrapAmount(wmoveBalanceDisplay.toString());
    }
  }, [wrapDirection, moveBalanceDisplay, wmoveBalanceDisplay]);

  // Handle wrap/unwrap action based on direction
  const handleWrapUnwrapAction = useCallback(() => {
    if (wrapDirection === 'wrap') {
      handleWrap();
    } else {
      handleUnwrap();
    }
  }, [wrapDirection, handleWrap, handleUnwrap]);

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Heading size="lg">Liquidity Pool</Heading>

        {/* Pool Stats */}
        <Card>
          <CardHeader>
            <Heading size="md">Pool Reserves</Heading>
          </CardHeader>
          <CardBody>
            {poolLoading ? (
              <Center py={4}>
                <Spinner />
              </Center>
            ) : poolReserves ? (
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <Box>
                  <Text fontSize="sm" color="gray.500">
                    RATHER Reserve
                  </Text>
                  <Text fontSize="xl" fontWeight="bold">
                    {fromOnChainAmount(poolReserves.reserveX).toLocaleString()}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.500">
                    WMOVE Reserve
                  </Text>
                  <Text fontSize="xl" fontWeight="bold">
                    {fromOnChainAmount(poolReserves.reserveY).toLocaleString()}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.500">
                    Status
                  </Text>
                  <Badge colorScheme={isPoolInitialized ? 'green' : 'red'}>
                    {isPoolInitialized ? 'Active' : 'Not Initialized'}
                  </Badge>
                </Box>
              </SimpleGrid>
            ) : (
              <Text color="gray.500">No pool data available</Text>
            )}
          </CardBody>
        </Card>

        {/* Swap Card */}
        <Card>
          <CardHeader>
            <Heading size="md">Swap Tokens</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={6}>
              <ButtonGroup size="sm" isAttached variant="outline" width="100%">
                <Button
                  flex={1}
                  isActive={swapDirection === 'wmove-to-rather'}
                  onClick={() => handleDirectionChange('wmove-to-rather')}
                >
                  WMOVE → RATHER
                </Button>
                <Button
                  flex={1}
                  isActive={swapDirection === 'rather-to-wmove'}
                  onClick={() => handleDirectionChange('rather-to-wmove')}
                >
                  RATHER → WMOVE
                </Button>
              </ButtonGroup>

              <FormControl>
                <FormLabel>
                  <HStack justify="space-between" width="100%">
                    <Text>Amount ({inputTokenLabel})</Text>
                    <Text fontSize="sm" color="gray.500">
                      Balance:{' '}
                      {swapDirection === 'wmove-to-rather'
                        ? wmoveBalanceLoading
                          ? '...'
                          : wmoveBalanceDisplay.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })
                        : ratherBalanceLoading
                          ? '...'
                          : ratherBalanceDisplay.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                    </Text>
                  </HStack>
                </FormLabel>
                <NumberInput
                  value={swapAmount}
                  onChange={(value) => setSwapAmount(value)}
                  min={0}
                  precision={8}
                >
                  <NumberInputField placeholder="0.0" />
                </NumberInput>
              </FormControl>

              <Box width="100%" p={4} bg="gray.50" borderRadius="md" _dark={{ bg: 'gray.700' }}>
                <HStack justify="space-between">
                  <Text color="gray.500">You receive (est.)</Text>
                  <Text fontWeight="bold">
                    {quoteLoading ? (
                      <Spinner size="sm" />
                    ) : (
                      `${estimatedOutput.toLocaleString()} ${outputTokenLabel}`
                    )}
                  </Text>
                </HStack>
              </Box>

              <Button
                colorScheme="purple"
                width="100%"
                size="lg"
                onClick={handleSwap}
                isLoading={isSwapping}
                isDisabled={isSwapDisabled}
              >
                {swapButtonLabel}
              </Button>
            </VStack>
          </CardBody>
        </Card>

        {/* Wrap/Unwrap MOVE Card */}
        <Card>
          <CardHeader>
            <Heading size="md">Wrap / Unwrap MOVE</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={6}>
              <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
                Convert between native MOVE and WMOVE (Wrapped MOVE). WMOVE is required for pool
                operations.
              </Text>

              {/* Balance Display */}
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} width="100%">
                <Box p={3} bg="gray.50" borderRadius="md" _dark={{ bg: 'gray.700' }}>
                  <Stat size="sm">
                    <StatLabel>MOVE Balance</StatLabel>
                    <StatNumber fontSize="lg">
                      {moveBalanceLoading ? (
                        <Spinner size="sm" />
                      ) : (
                        `${moveBalanceDisplay.toLocaleString(undefined, { maximumFractionDigits: 4 })} MOVE`
                      )}
                    </StatNumber>
                    <StatHelpText>Native token</StatHelpText>
                  </Stat>
                </Box>
                <Box p={3} bg="blue.50" borderRadius="md" _dark={{ bg: 'blue.900' }}>
                  <Stat size="sm">
                    <StatLabel>WMOVE Balance</StatLabel>
                    <StatNumber fontSize="lg">
                      {wmoveBalanceLoading ? (
                        <Spinner size="sm" />
                      ) : (
                        `${wmoveBalanceDisplay.toLocaleString(undefined, { maximumFractionDigits: 4 })} WMOVE`
                      )}
                    </StatNumber>
                    <StatHelpText>Wrapped token</StatHelpText>
                  </Stat>
                </Box>
              </SimpleGrid>

              {/* Direction Toggle */}
              <ButtonGroup size="sm" isAttached variant="outline" width="100%">
                <Button
                  flex={1}
                  isActive={wrapDirection === 'wrap'}
                  onClick={() => handleWrapDirectionChange('wrap')}
                >
                  MOVE → WMOVE
                </Button>
                <Button
                  flex={1}
                  isActive={wrapDirection === 'unwrap'}
                  onClick={() => handleWrapDirectionChange('unwrap')}
                >
                  WMOVE → MOVE
                </Button>
              </ButtonGroup>

              {/* Unified Wrap/Unwrap Input */}
              <FormControl>
                <FormLabel>{wrapDirection === 'wrap' ? 'MOVE Amount' : 'WMOVE Amount'}</FormLabel>
                <HStack>
                  <NumberInput
                    flex={1}
                    value={wrapUnwrapAmount}
                    onChange={(value) => setWrapUnwrapAmount(value)}
                    min={0}
                    max={wrapDirection === 'wrap' ? moveBalanceDisplay : wmoveBalanceDisplay}
                    precision={8}
                  >
                    <NumberInputField placeholder="0.0" />
                  </NumberInput>
                  <Button size="md" onClick={handleMaxWrapUnwrap} variant="outline">
                    MAX
                  </Button>
                </HStack>
                <FormHelperText>
                  Available:{' '}
                  {wrapDirection === 'wrap'
                    ? `${moveBalanceDisplay.toLocaleString(undefined, { maximumFractionDigits: 4 })} MOVE`
                    : `${wmoveBalanceDisplay.toLocaleString(undefined, { maximumFractionDigits: 4 })} WMOVE`}
                </FormHelperText>
              </FormControl>

              {/* Output Display */}
              <Box width="100%" p={4} bg="gray.50" borderRadius="md" _dark={{ bg: 'gray.700' }}>
                <HStack justify="space-between">
                  <Text color="gray.500">You receive</Text>
                  <HStack>
                    <Text fontWeight="bold">
                      {wrapUnwrapAmount && parseFloat(wrapUnwrapAmount) > 0
                        ? parseFloat(wrapUnwrapAmount).toLocaleString()
                        : '0'}
                    </Text>
                    <Text fontWeight="bold">{wrapDirection === 'wrap' ? 'WMOVE' : 'MOVE'}</Text>
                  </HStack>
                </HStack>
              </Box>

              <Button
                colorScheme={wrapDirection === 'wrap' ? 'blue' : 'orange'}
                width="100%"
                size="lg"
                onClick={handleWrapUnwrapAction}
                isLoading={wrapDirection === 'wrap' ? isWrapping : isUnwrapping}
                isDisabled={
                  !currentAddress || !wrapUnwrapAmount || parseFloat(wrapUnwrapAmount) <= 0
                }
              >
                {wrapDirection === 'wrap' ? 'Wrap MOVE' : 'Unwrap WMOVE'}
              </Button>
            </VStack>
          </CardBody>
        </Card>

        {/* Add/Remove Liquidity Card */}
        <Card>
          <CardHeader>
            <Heading size="md">Manage Liquidity</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={6}>
              {/* LP Token Balance Display */}
              <Box width="100%" p={4} bg="purple.50" borderRadius="md" _dark={{ bg: 'purple.900' }}>
                <Stat>
                  <StatLabel>Your LP Token Balance</StatLabel>
                  <StatNumber>
                    {lpBalanceLoading ? (
                      <Spinner size="sm" />
                    ) : (
                      `${lpBalanceDisplay.toLocaleString(undefined, { maximumFractionDigits: 8 })} LP`
                    )}
                  </StatNumber>
                  <StatHelpText>LP tokens represent your share of the pool</StatHelpText>
                </Stat>
              </Box>

              <Tabs width="100%" variant="enclosed" colorScheme="purple">
                <TabList>
                  <Tab>Add Liquidity</Tab>
                  <Tab>Remove Liquidity</Tab>
                </TabList>

                <TabPanels>
                  {/* Add Liquidity Panel */}
                  <TabPanel px={0}>
                    <VStack spacing={4}>
                      <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
                        Add both RATHER and WMOVE tokens to the pool to receive LP tokens. Amounts
                        are auto-balanced based on the current pool ratio.
                      </Text>

                      {priceRatio !== null && (
                        <Box
                          width="100%"
                          p={3}
                          bg="blue.50"
                          borderRadius="md"
                          _dark={{ bg: 'blue.900' }}
                        >
                          <Text fontSize="sm" color="blue.700" _dark={{ color: 'blue.200' }}>
                            Current ratio: 1 RATHER = {priceRatio.toFixed(8)} WMOVE
                          </Text>
                        </Box>
                      )}

                      <FormControl>
                        <FormLabel>
                          <HStack justify="space-between" width="100%">
                            <Text>RATHER Amount</Text>
                            <Text fontSize="sm" color="gray.500">
                              Balance:{' '}
                              {ratherBalanceLoading
                                ? '...'
                                : ratherBalanceDisplay.toLocaleString(undefined, {
                                    maximumFractionDigits: 4,
                                  })}
                            </Text>
                          </HStack>
                        </FormLabel>
                        <NumberInput
                          value={addAmountRather}
                          onChange={handleRatherAmountChange}
                          min={0}
                          precision={8}
                        >
                          <NumberInputField placeholder="0.0" />
                        </NumberInput>
                      </FormControl>

                      <FormControl>
                        <FormLabel>
                          <HStack justify="space-between" width="100%">
                            <Text>WMOVE Amount</Text>
                            <Text fontSize="sm" color="gray.500">
                              Balance:{' '}
                              {wmoveBalanceLoading
                                ? '...'
                                : wmoveBalanceDisplay.toLocaleString(undefined, {
                                    maximumFractionDigits: 4,
                                  })}
                            </Text>
                          </HStack>
                        </FormLabel>
                        <NumberInput
                          value={addAmountWmove}
                          onChange={handleWmoveAmountChange}
                          min={0}
                          precision={8}
                        >
                          <NumberInputField placeholder="0.0" />
                        </NumberInput>
                        <FormHelperText>
                          Amounts are automatically balanced to match the pool ratio.
                        </FormHelperText>
                      </FormControl>

                      <Button
                        colorScheme="green"
                        width="100%"
                        size="lg"
                        onClick={handleAddLiquidity}
                        isLoading={isAddingLiquidity}
                        isDisabled={isAddLiquidityDisabled}
                      >
                        Add Liquidity
                      </Button>
                    </VStack>
                  </TabPanel>

                  {/* Remove Liquidity Panel */}
                  <TabPanel px={0}>
                    <VStack spacing={4}>
                      <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
                        Burn LP tokens to receive your share of RATHER and WMOVE back.
                      </Text>

                      <FormControl>
                        <FormLabel>LP Tokens to Remove</FormLabel>
                        <HStack>
                          <NumberInput
                            flex={1}
                            value={removeAmount}
                            onChange={(value) => setRemoveAmount(value)}
                            min={0}
                            max={lpBalanceDisplay}
                            precision={8}
                          >
                            <NumberInputField placeholder="0.0" />
                          </NumberInput>
                          <Button size="sm" onClick={handleMaxRemove} variant="outline">
                            MAX
                          </Button>
                        </HStack>
                        <FormHelperText>
                          Available:{' '}
                          {lpBalanceDisplay.toLocaleString(undefined, { maximumFractionDigits: 8 })}{' '}
                          LP
                        </FormHelperText>
                      </FormControl>

                      {removeAmountOnChain > lpBalance && (
                        <Alert status="error" borderRadius="md">
                          <AlertIcon />
                          Insufficient LP token balance
                        </Alert>
                      )}

                      <Button
                        colorScheme="red"
                        width="100%"
                        size="lg"
                        onClick={handleRemoveLiquidity}
                        isLoading={isRemovingLiquidity}
                        isDisabled={isRemoveLiquidityDisabled}
                      >
                        Remove Liquidity
                      </Button>
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
}
