'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,

  Card,
  CardBody,
  CardHeader,
  Container,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Spinner,
  Text,
  useDisclosure,
  useToast,
  VStack,
  Center,
  Tooltip,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, ViewIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/lib/wallet-context';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { useNftHoldings, NftHolding } from '@/hooks/useNftHoldings';
import { getExplorerLink } from '@/utils/explorer-links';
import { waitForTransaction } from '@/lib/movement-client';
import { TokenImage } from '@/components/nft/TokenImage';
import {
  buildListNftTransaction,
  buildBuyNftTransaction,
  buildCancelListingTransaction,
  fetchListing,
  Listing,
} from '@/lib/marketplace/operations';

const toOnChainAmount = (value: number, decimals = 8) => Math.floor(value * Math.pow(10, decimals));
const fromOnChainAmount = (value: number, decimals = 8) => value / Math.pow(10, decimals);

type ListingFilter = 'all' | 'listed' | 'not-listed';

const ITEMS_PER_PAGE = 8;

interface NftWithListing extends NftHolding {
  listing?: Listing;
}

// ============ NFT Detail Modal ============
interface NftDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  nft: NftWithListing | null;
  isListingLoading: boolean;
  onList: (nftAddress: string, price: number) => Promise<void>;
  onUnlist: (nftAddress: string) => Promise<void>;
  isActionPending: boolean;
}

function NftDetailModal({
  isOpen,
  onClose,
  nft,
  isListingLoading,
  onList,
  onUnlist,
  isActionPending,
}: NftDetailModalProps) {
  const [listPrice, setListPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleList = async () => {
    if (!nft) return;
    const price = parseFloat(listPrice);
    if (isNaN(price) || price <= 0) return;

    setIsSubmitting(true);
    try {
      await onList(nft.nftAddress, toOnChainAmount(price));
      setListPrice('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlist = async () => {
    if (!nft) return;
    setIsSubmitting(true);
    try {
      await onUnlist(nft.nftAddress);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!nft) return null;

  const isListed = !!nft.listing;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack>
            <Text>NFT #{nft.tokenId}</Text>
            {isListingLoading ? (
              <Spinner size="xs" />
            ) : isListed ? (
              <Badge colorScheme="green">Listed</Badge>
            ) : (
              <Badge colorScheme="gray">Not Listed</Badge>
            )}
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Box borderRadius="lg" overflow="hidden">
              <TokenImage nftAddress={nft.nftAddress} alt={`NFT #${nft.tokenId}`} />
            </Box>

            <Box>
              <Text fontSize="sm" color="gray.500" mb={1}>
                NFT Address
              </Text>
              <Text fontSize="sm" fontFamily="mono" wordBreak="break-all">
                {nft.nftAddress}
              </Text>
            </Box>

            <Box>
              <Text fontSize="sm" color="gray.500" mb={1}>
                Collection Address
              </Text>
              <Text fontSize="sm" fontFamily="mono" wordBreak="break-all">
                {nft.collectionAddress}
              </Text>
            </Box>

            {isListed && nft.listing && (
              <Box bg="green.50" p={4} borderRadius="md" _dark={{ bg: 'green.900' }}>
                <HStack justify="space-between">
                  <Text color="green.600" _dark={{ color: 'green.200' }}>
                    Listed Price:
                  </Text>
                  <Text fontWeight="bold" color="green.600" _dark={{ color: 'green.200' }}>
                    {fromOnChainAmount(nft.listing.price).toFixed(4)} MOVE
                  </Text>
                </HStack>
              </Box>
            )}

            <Divider />

            {isListed ? (
              <Button
                colorScheme="red"
                variant="outline"
                onClick={handleUnlist}
                isLoading={isSubmitting || isActionPending}
              >
                Cancel Listing
              </Button>
            ) : (
              <VStack spacing={3}>
                <FormControl>
                  <FormLabel>Listing Price (MOVE)</FormLabel>
                  <NumberInput min={0} precision={4}>
                    <NumberInputField
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                      placeholder="Enter price in MOVE"
                    />
                  </NumberInput>
                </FormControl>
                <Button
                  colorScheme="purple"
                  width="100%"
                  onClick={handleList}
                  isLoading={isSubmitting || isActionPending}
                  isDisabled={!listPrice || parseFloat(listPrice) <= 0}
                >
                  List for Sale
                </Button>
              </VStack>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ============ NFT Card ============
interface NftCardProps {
  nft: NftWithListing;
  isListingLoading: boolean;
  onOpenDetail: (nft: NftWithListing) => void;
  onList: (nftAddress: string, price: number) => Promise<void>;
  onUnlist: (nftAddress: string) => Promise<void>;
  isActionPending: boolean;
}

function NftCard({
  nft,
  isListingLoading,
  onOpenDetail,
  onList,
  onUnlist,
  isActionPending,
}: NftCardProps) {
  const [listPrice, setListPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleList = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const price = parseFloat(listPrice);
    if (isNaN(price) || price <= 0) return;

    setIsSubmitting(true);
    try {
      await onList(nft.nftAddress, toOnChainAmount(price));
      setListPrice('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSubmitting(true);
    try {
      await onUnlist(nft.nftAddress);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isListed = !!nft.listing;

  return (
    <Card
      overflow="hidden"
      cursor="pointer"
      transition="all 0.2s"
      _hover={{ transform: 'translateY(-2px)', shadow: 'lg' }}
      onClick={() => onOpenDetail(nft)}
    >
      <Box position="relative">
        <TokenImage nftAddress={nft.nftAddress} alt={`NFT #${nft.tokenId}`} />
        <Tooltip label="View Details">
          <IconButton
            aria-label="View details"
            icon={<ViewIcon />}
            size="sm"
            position="absolute"
            top={2}
            right={2}
            colorScheme="blackAlpha"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(nft);
            }}
          />
        </Tooltip>
      </Box>
      <CardBody>
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between">
            <Heading size="sm">NFT #{nft.tokenId}</Heading>
            {isListingLoading ? (
              <Spinner size="xs" />
            ) : isListed ? (
              <Badge colorScheme="green">Listed</Badge>
            ) : (
              <Badge colorScheme="gray">Not Listed</Badge>
            )}
          </HStack>

          <Text fontSize="xs" color="gray.500" noOfLines={1} fontFamily="mono">
            {nft.nftAddress.slice(0, 16)}...{nft.nftAddress.slice(-8)}
          </Text>

          {isListed && nft.listing && (
            <Box bg="green.50" p={2} borderRadius="md" _dark={{ bg: 'green.900' }}>
              <Text
                fontSize="sm"
                fontWeight="bold"
                color="green.600"
                _dark={{ color: 'green.200' }}
              >
                Price: {fromOnChainAmount(nft.listing.price).toFixed(4)} MOVE
              </Text>
            </Box>
          )}

          <Divider />

          {isListed ? (
            <Button
              colorScheme="red"
              variant="outline"
              size="sm"
              onClick={handleUnlist}
              isLoading={isSubmitting || isActionPending}
            >
              Cancel Listing
            </Button>
          ) : (
            <VStack spacing={2}>
              <NumberInput size="sm" min={0} precision={4} width="100%">
                <NumberInputField
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  placeholder="Price in MOVE"
                  onClick={(e) => e.stopPropagation()}
                />
              </NumberInput>
              <Button
                colorScheme="purple"
                size="sm"
                width="100%"
                onClick={handleList}
                isLoading={isSubmitting || isActionPending}
                isDisabled={!listPrice || parseFloat(listPrice) <= 0}
              >
                List for Sale
              </Button>
            </VStack>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}

// ============ Main Component ============
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

  // Modal state
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedNft, setSelectedNft] = useState<NftWithListing | null>(null);

  // Filter state
  const [filter, setFilter] = useState<ListingFilter>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Track pending action to prevent double-clicks
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Buy NFT state
  const [buyNftAddress, setBuyNftAddress] = useState('');
  const [isBuying, setIsBuying] = useState(false);

  // Fetch listing status for all user NFTs
  const {
    data: listingsMap,
    isLoading: listingsLoading,
    refetch: refetchListings,
  } = useQuery({
    queryKey: ['user-nft-listings', nfts.map((n) => n.nftAddress).join(',')],
    queryFn: async () => {
      const map: Record<string, Listing | undefined> = {};
      await Promise.all(
        nfts.map(async (nft) => {
          try {
            const listing = await fetchListing(nft.nftAddress);
            map[nft.nftAddress] = listing;
          } catch {
            map[nft.nftAddress] = undefined;
          }
        })
      );
      return map;
    },
    enabled: nfts.length > 0,
    refetchInterval: 15000,
  });

  // Fetch listing data for buy section
  const { data: buyListingData, isLoading: buyListingLoading } = useQuery({
    queryKey: ['buy-listing', buyNftAddress],
    queryFn: () => fetchListing(buyNftAddress),
    enabled: buyNftAddress.length >= 60,
  });

  // Combine NFTs with listing data
  const nftsWithListings: NftWithListing[] = useMemo(() => {
    return nfts.map((nft) => ({
      ...nft,
      listing: listingsMap?.[nft.nftAddress],
    }));
  }, [nfts, listingsMap]);

  // Filter NFTs based on listing status
  const filteredNfts = useMemo(() => {
    if (filter === 'all') return nftsWithListings;

    return nftsWithListings.filter((nft) => {
      const isListed = !!nft.listing;
      if (filter === 'listed') return isListed;
      if (filter === 'not-listed') return !isListed;
      return true;
    });
  }, [nftsWithListings, filter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredNfts.length / ITEMS_PER_PAGE);
  const paginatedNfts = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNfts.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [filteredNfts, currentPage]);

  // Reset to page 1 when filter changes
  const handleFilterChange = (newFilter: ListingFilter) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  // Open detail modal
  const handleOpenDetail = (nft: NftWithListing) => {
    setSelectedNft(nft);
    onOpen();
  };

  // Handle list NFT
  const handleListNft = useCallback(
    async (nftAddress: string, priceInOctas: number) => {
      if (!currentAddress) return;

      setPendingAction(nftAddress);
      try {
        const txPayload = buildListNftTransaction(nftAddress, priceInOctas);
        const response = await signAndSubmitTransaction(txPayload);

        toast({
          title: 'Transaction submitted',
          description: 'Listing your NFT...',
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

        void refetchListings();
        void refetchNfts();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Transaction failed';
        toast({
          title: 'Listing failed',
          description: message,
          status: 'error',
        });
      } finally {
        setPendingAction(null);
      }
    },
    [currentAddress, signAndSubmitTransaction, toast, refetchListings, refetchNfts]
  );

  // Handle cancel listing
  const handleUnlistNft = useCallback(
    async (nftAddress: string) => {
      if (!currentAddress) return;

      setPendingAction(nftAddress);
      try {
        const txPayload = buildCancelListingTransaction(nftAddress);
        const response = await signAndSubmitTransaction(txPayload);

        toast({
          title: 'Transaction submitted',
          description: 'Canceling listing...',
          status: 'info',
          duration: 5000,
        });

        await waitForTransaction(response.hash);

        toast({
          title: 'Listing canceled!',
          description: (
            <Link href={getExplorerLink(response.hash, 'testnet')} isExternal>
              View on Explorer <ExternalLinkIcon mx="2px" />
            </Link>
          ),
          status: 'success',
          duration: 10000,
        });

        void refetchListings();
        void refetchNfts();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Transaction failed';
        toast({
          title: 'Cancel failed',
          description: message,
          status: 'error',
        });
      } finally {
        setPendingAction(null);
      }
    },
    [currentAddress, signAndSubmitTransaction, toast, refetchListings, refetchNfts]
  );

  // Handle buy NFT
  const handleBuyNft = useCallback(async () => {
    if (!currentAddress || !buyNftAddress || !buyListingData) return;

    setIsBuying(true);
    try {
      const txPayload = buildBuyNftTransaction(buyNftAddress);
      const response = await signAndSubmitTransaction(txPayload);

      toast({
        title: 'Transaction submitted',
        description: 'Purchasing NFT...',
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
      void refetchListings();
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
  }, [
    currentAddress,
    buyNftAddress,
    buyListingData,
    signAndSubmitTransaction,
    toast,
    refetchNfts,
    refetchListings,
  ]);

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Heading size="lg">NFT Marketplace</Heading>

        {/* My NFTs Section */}
        <Card>
          <CardHeader>
            <HStack justify="space-between" wrap="wrap" gap={4}>
              <VStack align="start" spacing={1}>
                <HStack>
                  <Heading size="md">My NFTs</Heading>
                  <Badge colorScheme="purple">{nfts.length}</Badge>
                </HStack>
                <Text fontSize="sm" color="gray.500">
                  Your NFT collection. List them for sale or manage existing listings.
                </Text>
              </VStack>
              <HStack>
                <Text fontSize="sm" color="gray.500">
                  Filter:
                </Text>
                <Select
                  size="sm"
                  width="150px"
                  value={filter}
                  onChange={(e) => handleFilterChange(e.target.value as ListingFilter)}
                >
                  <option value="all">All NFTs</option>
                  <option value="listed">Listed</option>
                  <option value="not-listed">Not Listed</option>
                </Select>
              </HStack>
            </HStack>
          </CardHeader>
          <CardBody>
            {!connected ? (
              <Center py={8}>
                <Text color="gray.500">Connect your wallet to view your NFTs</Text>
              </Center>
            ) : nftsLoading ? (
              <Center py={8}>
                <Spinner size="lg" />
              </Center>
            ) : paginatedNfts.length > 0 ? (
              <VStack spacing={6}>
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={4} width="100%">
                  {paginatedNfts.map((nft) => (
                    <NftCard
                      key={nft.nftAddress}
                      nft={nft}
                      isListingLoading={listingsLoading}
                      onOpenDetail={handleOpenDetail}
                      onList={handleListNft}
                      onUnlist={handleUnlistNft}
                      isActionPending={pendingAction === nft.nftAddress}
                    />
                  ))}
                </SimpleGrid>

                {/* Pagination */}
                {totalPages > 1 && (
                  <HStack spacing={4}>
                    <IconButton
                      aria-label="Previous page"
                      icon={<ChevronLeftIcon />}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      isDisabled={currentPage === 1}
                      size="sm"
                    />
                    <Text fontSize="sm" color="gray.500">
                      Page {currentPage} of {totalPages}
                    </Text>
                    <IconButton
                      aria-label="Next page"
                      icon={<ChevronRightIcon />}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      isDisabled={currentPage === totalPages}
                      size="sm"
                    />
                  </HStack>
                )}
              </VStack>
            ) : nfts.length > 0 && filteredNfts.length === 0 ? (
              <Center py={8}>
                <Text color="gray.500">No NFTs match the current filter</Text>
              </Center>
            ) : (
              <Center py={8}>
                <VStack spacing={2}>
                  <Text color="gray.500">You don&apos;t own any NFTs yet</Text>
                  <Text fontSize="sm" color="gray.400">
                    NFTs can be minted from the Admin page or purchased below
                  </Text>
                </VStack>
              </Center>
            )}
          </CardBody>
        </Card>

        {/* Buy NFT Section */}
        <Card>
          <CardHeader>
            <Heading size="md">Buy NFT</Heading>
          </CardHeader>
          <CardBody>
            <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
              <GridItem>
                <VStack spacing={4} align="stretch">
                  <Text fontSize="sm" color="gray.500">
                    Enter an NFT address to view its listing details and purchase it.
                  </Text>
                  <FormControl>
                    <FormLabel>NFT Object Address</FormLabel>
                    <Input
                      value={buyNftAddress}
                      onChange={(e) => setBuyNftAddress(e.target.value)}
                      placeholder="0x..."
                    />
                  </FormControl>

                  {buyListingLoading && buyNftAddress.length >= 60 && (
                    <Center py={4}>
                      <Spinner size="sm" />
                    </Center>
                  )}

                  {buyListingData && (
                    <Box p={4} bg="gray.50" borderRadius="md" _dark={{ bg: 'gray.700' }}>
                      <VStack align="stretch" spacing={2}>
                        <HStack justify="space-between">
                          <Text color="gray.500">Price:</Text>
                          <Text fontWeight="bold">
                            {fromOnChainAmount(buyListingData.price).toFixed(4)} MOVE
                          </Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text color="gray.500">Seller:</Text>
                          <Text fontSize="sm" noOfLines={1} fontFamily="mono">
                            {buyListingData.seller.slice(0, 10)}...{buyListingData.seller.slice(-8)}
                          </Text>
                        </HStack>
                      </VStack>
                    </Box>
                  )}

                  {buyNftAddress.length >= 60 && !buyListingLoading && !buyListingData && (
                    <Text color="orange.500" fontSize="sm">
                      This NFT is not currently listed for sale
                    </Text>
                  )}

                  <Button
                    colorScheme="purple"
                    onClick={handleBuyNft}
                    isLoading={isBuying}
                    isDisabled={!buyNftAddress || !buyListingData || !connected}
                  >
                    Buy NFT
                  </Button>
                </VStack>
              </GridItem>

              {/* NFT Preview Image */}
              <GridItem>
                {buyNftAddress.length >= 60 ? (
                  <Box borderRadius="lg" overflow="hidden">
                    <TokenImage nftAddress={buyNftAddress} alt="NFT Preview" />
                  </Box>
                ) : (
                  <Center
                    h="100%"
                    minH="200px"
                    bg="gray.50"
                    borderRadius="lg"
                    _dark={{ bg: 'gray.700' }}
                  >
                    <Text color="gray.400" fontSize="sm">
                      Enter an NFT address to preview
                    </Text>
                  </Center>
                )}
              </GridItem>
            </Grid>
          </CardBody>
        </Card>
      </VStack>

      {/* NFT Detail Modal */}
      <NftDetailModal
        isOpen={isOpen}
        onClose={onClose}
        nft={selectedNft}
        isListingLoading={listingsLoading}
        onList={handleListNft}
        onUnlist={handleUnlistNft}
        isActionPending={pendingAction === selectedNft?.nftAddress}
      />
    </Container>
  );
}
