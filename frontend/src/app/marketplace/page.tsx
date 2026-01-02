'use client';

import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  Container,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Link,
  NumberInput,
  NumberInputField,
  SimpleGrid,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast,
  VStack,
  Center,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/lib/wallet-context';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { useNftHoldings } from '@/hooks/useNftHoldings';
import { getExplorerLink } from '@/utils/explorer-links';
import { waitForTransaction } from '@/lib/movement-client';
import {
  buildMintNftTransaction,
  buildTransferNftTransaction,
  fetchTokenUri,
} from '@/lib/nft/operations';
import {
  buildListNftTransaction,
  buildBuyNftTransaction,
  buildCancelListingTransaction,
  fetchListing,
  isNftListed,
} from '@/lib/marketplace/operations';
import { MODULE_ADDRESS } from '@/constants/contracts';

const toOnChainAmount = (value: number, decimals = 8) => Math.floor(value * Math.pow(10, decimals));
const fromOnChainAmount = (value: number, decimals = 8) => value / Math.pow(10, decimals);

export default function MarketplacePage() {
  const toast = useToast();
  const currentAddress = useCurrentAddress();
  const { signAndSubmitTransaction, connected } = useWallet();
  const {
    data: nftHoldings,
    isLoading: nftsLoading,
    refetch: refetchNfts,
  } = useNftHoldings(currentAddress || undefined);
  const nfts = nftHoldings?.items || [];

  // Mint NFT state
  const [isMinting, setIsMinting] = useState(false);

  // List NFT state
  const [selectedNftAddress, setSelectedNftAddress] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [isListing, setIsListing] = useState(false);

  // Buy NFT state
  const [buyNftAddress, setBuyNftAddress] = useState('');
  const [isBuying, setIsBuying] = useState(false);

  // Transfer NFT state
  const [transferNftAddress, setTransferNftAddress] = useState('');
  const [transferRecipient, setTransferRecipient] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Fetch active listing for buy section
  const { data: listingData, isLoading: listingLoading } = useQuery({
    queryKey: ['listing', buyNftAddress],
    queryFn: () => fetchListing(buyNftAddress),
    enabled: buyNftAddress.length >= 60,
  });

  const handleMint = useCallback(async () => {
    if (!currentAddress) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet first',
        status: 'warning',
      });
      return;
    }

    setIsMinting(true);
    try {
      const txPayload = buildMintNftTransaction(currentAddress);
      const response = await signAndSubmitTransaction(txPayload);

      toast({
        title: 'Transaction submitted',
        description: 'Waiting for confirmation...',
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(response.hash);

      toast({
        title: 'NFT minted!',
        description: (
          <Link href={getExplorerLink(response.hash, 'testnet')} isExternal>
            View on Explorer <ExternalLinkIcon mx="2px" />
          </Link>
        ),
        status: 'success',
        duration: 10000,
      });

      void refetchNfts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Transaction failed';
      toast({
        title: 'Mint failed',
        description: message,
        status: 'error',
      });
    } finally {
      setIsMinting(false);
    }
  }, [currentAddress, signAndSubmitTransaction, toast, refetchNfts]);

  const handleListNft = useCallback(async () => {
    if (!currentAddress || !selectedNftAddress || !listPrice) return;

    setIsListing(true);
    try {
      const priceInOctas = toOnChainAmount(parseFloat(listPrice));
      const txPayload = buildListNftTransaction(selectedNftAddress, priceInOctas);
      const response = await signAndSubmitTransaction(txPayload);

      toast({
        title: 'Transaction submitted',
        description: 'Waiting for confirmation...',
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(response.hash);

      toast({
        title: 'NFT listed!',
        description: (
          <Link href={getExplorerLink(response.hash, 'testnet')} isExternal>
            View on Explorer <ExternalLinkIcon mx="2px" />
          </Link>
        ),
        status: 'success',
        duration: 10000,
      });

      setSelectedNftAddress('');
      setListPrice('');
      void refetchNfts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Transaction failed';
      toast({
        title: 'Listing failed',
        description: message,
        status: 'error',
      });
    } finally {
      setIsListing(false);
    }
  }, [currentAddress, selectedNftAddress, listPrice, signAndSubmitTransaction, toast, refetchNfts]);

  const handleBuyNft = useCallback(async () => {
    if (!currentAddress || !buyNftAddress || !listingData) return;

    setIsBuying(true);
    try {
      const txPayload = buildBuyNftTransaction(buyNftAddress);
      const response = await signAndSubmitTransaction(txPayload);

      toast({
        title: 'Transaction submitted',
        description: 'Waiting for confirmation...',
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(response.hash);

      toast({
        title: 'NFT purchased!',
        description: (
          <Link href={getExplorerLink(response.hash, 'testnet')} isExternal>
            View on Explorer <ExternalLinkIcon mx="2px" />
          </Link>
        ),
        status: 'success',
        duration: 10000,
      });

      setBuyNftAddress('');
      void refetchNfts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Transaction failed';
      toast({
        title: 'Purchase failed',
        description: message,
        status: 'error',
      });
    } finally {
      setIsBuying(false);
    }
  }, [currentAddress, buyNftAddress, listingData, signAndSubmitTransaction, toast, refetchNfts]);

  const handleTransferNft = useCallback(async () => {
    if (!currentAddress || !transferNftAddress || !transferRecipient) return;

    setIsTransferring(true);
    try {
      const txPayload = buildTransferNftTransaction(transferNftAddress, transferRecipient);
      const response = await signAndSubmitTransaction(txPayload);

      toast({
        title: 'Transaction submitted',
        description: 'Waiting for confirmation...',
        status: 'info',
        duration: 5000,
      });

      await waitForTransaction(response.hash);

      toast({
        title: 'NFT transferred!',
        description: (
          <Link href={getExplorerLink(response.hash, 'testnet')} isExternal>
            View on Explorer <ExternalLinkIcon mx="2px" />
          </Link>
        ),
        status: 'success',
        duration: 10000,
      });

      setTransferNftAddress('');
      setTransferRecipient('');
      void refetchNfts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Transaction failed';
      toast({
        title: 'Transfer failed',
        description: message,
        status: 'error',
      });
    } finally {
      setIsTransferring(false);
    }
  }, [
    currentAddress,
    transferNftAddress,
    transferRecipient,
    signAndSubmitTransaction,
    toast,
    refetchNfts,
  ]);

  if (!connected) {
    return (
      <Container maxW="container.md" py={10}>
        <Center>
          <VStack spacing={4}>
            <Heading size="lg">NFT Marketplace</Heading>
            <Text color="gray.500">Please connect your wallet to use the marketplace.</Text>
          </VStack>
        </Center>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Heading size="lg">NFT Marketplace</Heading>

        <Tabs colorScheme="purple" variant="enclosed">
          <TabList>
            <Tab>My NFTs</Tab>
            <Tab>Mint NFT</Tab>
            <Tab>List NFT</Tab>
            <Tab>Buy NFT</Tab>
            <Tab>Transfer NFT</Tab>
          </TabList>

          <TabPanels>
            {/* My NFTs Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Heading size="md">Your NFT Collection</Heading>
                {nftsLoading ? (
                  <Center py={8}>
                    <Spinner size="lg" />
                  </Center>
                ) : nfts.length > 0 ? (
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                    {nfts.map((nft, idx) => (
                      <Card key={nft.nftAddress || idx}>
                        <CardBody>
                          <Text fontWeight="bold">NFT #{nft.tokenId}</Text>
                          <Text fontSize="sm" color="gray.500" noOfLines={1}>
                            {nft.nftAddress?.slice(0, 20)}...
                          </Text>
                          <Text fontSize="xs" color="gray.400" mt={2}>
                            Collection: {nft.collectionAddress?.slice(0, 12)}...
                          </Text>
                        </CardBody>
                      </Card>
                    ))}
                  </SimpleGrid>
                ) : (
                  <Text color="gray.500" textAlign="center" py={8}>
                    You don't own any NFTs yet. Mint one to get started!
                  </Text>
                )}
              </VStack>
            </TabPanel>

            {/* Mint NFT Tab */}
            <TabPanel>
              <Card>
                <CardBody>
                  <VStack spacing={4}>
                    <Text color="gray.500">
                      Mint a new NFT from the collection. The NFT will be minted to your connected
                      wallet address.
                    </Text>
                    <Button
                      colorScheme="purple"
                      width="100%"
                      onClick={handleMint}
                      isLoading={isMinting}
                      isDisabled={!currentAddress}
                    >
                      Mint NFT
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            </TabPanel>

            {/* List NFT Tab */}
            <TabPanel>
              <Card>
                <CardBody>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel>NFT Object Address</FormLabel>
                      <Input
                        value={selectedNftAddress}
                        onChange={(e) => setSelectedNftAddress(e.target.value)}
                        placeholder="0x..."
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Price (MOVE)</FormLabel>
                      <NumberInput min={0} precision={8}>
                        <NumberInputField
                          value={listPrice}
                          onChange={(e) => setListPrice(e.target.value)}
                          placeholder="0.0"
                        />
                      </NumberInput>
                    </FormControl>
                    <Button
                      colorScheme="purple"
                      width="100%"
                      onClick={handleListNft}
                      isLoading={isListing}
                      isDisabled={!selectedNftAddress || !listPrice}
                    >
                      List NFT for Sale
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            </TabPanel>

            {/* Buy NFT Tab */}
            <TabPanel>
              <Card>
                <CardBody>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel>NFT Object Address</FormLabel>
                      <Input
                        value={buyNftAddress}
                        onChange={(e) => setBuyNftAddress(e.target.value)}
                        placeholder="0x..."
                      />
                    </FormControl>
                    {listingLoading && buyNftAddress.length >= 60 && <Spinner size="sm" />}
                    {listingData && (
                      <Box
                        p={4}
                        bg="gray.50"
                        borderRadius="md"
                        width="100%"
                        _dark={{ bg: 'gray.700' }}
                      >
                        <VStack align="stretch" spacing={2}>
                          <HStack justify="space-between">
                            <Text color="gray.500">Price:</Text>
                            <Text fontWeight="bold">
                              {fromOnChainAmount(listingData.price)} MOVE
                            </Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text color="gray.500">Seller:</Text>
                            <Text fontSize="sm" noOfLines={1}>
                              {listingData.seller.slice(0, 10)}...{listingData.seller.slice(-8)}
                            </Text>
                          </HStack>
                        </VStack>
                      </Box>
                    )}
                    <Button
                      colorScheme="purple"
                      width="100%"
                      onClick={handleBuyNft}
                      isLoading={isBuying}
                      isDisabled={!buyNftAddress || !listingData}
                    >
                      Buy NFT
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            </TabPanel>

            {/* Transfer NFT Tab */}
            <TabPanel>
              <Card>
                <CardBody>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel>NFT Object Address</FormLabel>
                      <Input
                        value={transferNftAddress}
                        onChange={(e) => setTransferNftAddress(e.target.value)}
                        placeholder="0x..."
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Recipient Address</FormLabel>
                      <Input
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        placeholder="0x..."
                      />
                    </FormControl>
                    <Button
                      colorScheme="purple"
                      width="100%"
                      onClick={handleTransferNft}
                      isLoading={isTransferring}
                      isDisabled={!transferNftAddress || !transferRecipient}
                    >
                      Transfer NFT
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Container>
  );
}
