'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@/lib/wallet-context';
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Text,
  Image,
  useDisclosure,
  HStack,
  Link,
  useToast,
} from '@chakra-ui/react';
import { ExternalLinkIcon, CheckIcon } from '@chakra-ui/icons';

interface WalletSelectionModalProps {
  children: React.ReactNode;
}

const NIGHTLY_ICON =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMUIxQjFGIi8+PHBhdGggZD0iTTggMTBDOCA4Ljg5NTQzIDguODk1NDMgOCAxMCA4SDIyQzIzLjEwNDYgOCAyNCA4Ljg5NTQzIDI0IDEwVjIyQzI0IDIzLjEwNDYgMjMuMTA0NiAyNCAyMiAyNEgxMEM4Ljg5NTQzIDI0IDggMjMuMTA0NiA4IDIyVjEwWiIgZmlsbD0iIzZFNTZDRiIvPjwvc3ZnPg==';

/**
 * Wallet selection modal - Supports Nightly and Pontem wallets
 * Uses enhanced connection handling for Movement Network
 */
export function WalletSelectionModal({ children }: WalletSelectionModalProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { wallets = [], connect, connected } = useWallet();
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const toast = useToast();

  // Filter and prioritize wallets for Movement Network
  const filteredWallets = wallets
    .filter((wallet) => {
      const name = wallet.name.toLowerCase();
      // Filter out incompatible wallets (Petra, Google, Apple don't support Movement)
      return !name.includes('petra') && !name.includes('google') && !name.includes('apple');
    })
    .filter((wallet, index, self) => {
      // Remove duplicates
      return index === self.findIndex((w) => w.name === wallet.name);
    })
    .sort((a, b) => {
      // Nightly wallet first (best Movement support)
      if (a.name.toLowerCase().includes('nightly')) return -1;
      if (b.name.toLowerCase().includes('nightly')) return 1;
      return 0;
    });

  // Find Nightly wallet for fallback display
  const nightlyWallet = wallets.find((w) => w.name === 'Nightly');
  const hasCompatibleWallets = filteredWallets.length > 0;

  const handleConnect = useCallback(
    async (walletName: string) => {
      setIsConnecting(walletName);
      try {
        await connect(walletName);
        toast({
          title: 'Wallet connected',
          description: `Connected to ${walletName} successfully`,
          status: 'success',
          duration: 3000,
          isClosable: true,
          icon: <CheckIcon />,
        });
        onClose();
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        toast({
          title: 'Connection failed',
          description: 'Failed to connect wallet. Please try again.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsConnecting(null);
      }
    },
    [connect, onClose, toast]
  );

  const handleInstallWallet = () => {
    window.open('https://nightly.app', '_blank');
  };

  const isNightly = (name: string) => name.toLowerCase().includes('nightly');

  // If already connected, just render children
  if (connected) {
    return <>{children}</>;
  }

  return (
    <>
      <div onClick={onOpen} style={{ cursor: 'pointer' }}>
        {children}
      </div>

      <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent>
          <ModalHeader textAlign="center">Connect Wallet</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <Text color="gray.500" fontSize="sm" textAlign="center">
                Connect your wallet to interact with the Movement blockchain.
              </Text>

              {hasCompatibleWallets ? (
                <VStack spacing={3} width="100%">
                  {filteredWallets.map((wallet) => {
                    const walletName = wallet.name;
                    const walletIcon = wallet.icon as string | undefined;
                    const isWalletNightly = isNightly(walletName);

                    return (
                      <Button
                        key={walletName}
                        width="100%"
                        size="lg"
                        colorScheme={isWalletNightly ? 'purple' : 'gray'}
                        variant={isWalletNightly ? 'solid' : 'outline'}
                        onClick={() => handleConnect(walletName)}
                        isLoading={isConnecting === walletName}
                        isDisabled={isConnecting !== null && isConnecting !== walletName}
                        loadingText="Connecting..."
                        leftIcon={
                          <Image
                            src={walletIcon || NIGHTLY_ICON}
                            alt={walletName}
                            boxSize="24px"
                            borderRadius="md"
                          />
                        }
                        justifyContent="flex-start"
                        px={4}
                      >
                        <HStack spacing={2} flex={1} justify="space-between">
                          <Text>{walletName}</Text>
                          {isWalletNightly && (
                            <Text
                              fontSize="xs"
                              bg="whiteAlpha.200"
                              px={2}
                              py={0.5}
                              borderRadius="full"
                            >
                              Recommended
                            </Text>
                          )}
                        </HStack>
                      </Button>
                    );
                  })}
                </VStack>
              ) : (
                <VStack spacing={4} width="100%">
                  <Button
                    width="100%"
                    size="lg"
                    colorScheme="gray"
                    variant="outline"
                    onClick={handleInstallWallet}
                    leftIcon={
                      <Image
                        src={nightlyWallet?.icon || NIGHTLY_ICON}
                        alt="Nightly"
                        boxSize="24px"
                        borderRadius="md"
                      />
                    }
                  >
                    Install Nightly Wallet
                  </Button>
                  <Text color="gray.500" fontSize="xs" textAlign="center">
                    Nightly wallet is recommended for Movement Network.
                  </Text>
                  <Link href="https://nightly.app" isExternal color="purple.500" fontSize="sm">
                    <HStack spacing={1}>
                      <Text>Get Nightly Wallet</Text>
                      <ExternalLinkIcon boxSize={3} />
                    </HStack>
                  </Link>
                </VStack>
              )}

              <Text color="gray.400" fontSize="xs" textAlign="center" pt={2}>
                By connecting, you agree to the Terms of Service.
              </Text>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
