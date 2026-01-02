'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardHeader,
  Container,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Link,
  NumberInput,
  NumberInputField,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
  Center,
  VStack,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
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
  toOnChainAmount,
  fromOnChainAmount,
  poolExists,
} from '@/lib/pool/operations';
import { waitForTransaction } from '@/lib/movement-client';

type SwapDirection = 'wmove-to-rather' | 'rather-to-wmove';

const DECIMALS = 8;

export default function LiquidityPage() {
  const toast = useToast();
  const currentAddress = useCurrentAddress();
  const { signAndSubmitTransaction, connected } = useWallet();

  const [swapDirection, setSwapDirection] = useState<SwapDirection>('wmove-to-rather');
  const [swapAmount, setSwapAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);

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
                <FormLabel>Amount ({inputTokenLabel})</FormLabel>
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
      </VStack>
    </Container>
  );
}
