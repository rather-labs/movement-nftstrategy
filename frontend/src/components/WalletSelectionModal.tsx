'use client';

import { useState } from 'react';
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
  HStack,
  Image,
  useDisclosure,
  Spinner,
} from '@chakra-ui/react';

interface WalletSelectionModalProps {
  children: React.ReactNode;
}

/**
 * Wallet selection modal
 * Shows available wallets and handles connection
 */
export function WalletSelectionModal({ children }: WalletSelectionModalProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { wallets = [], connect, connected } = useWallet();
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  // Filter wallets to show only relevant ones (Nightly preferred)
  const availableWallets = (wallets || [])
    .filter((wallet) => {
      const name = wallet.name.toLowerCase();
      // Exclude Google/AptosConnect wallets that don't support Movement
      return !name.includes('google') && !name.includes('aptosconnect');
    })
    .sort((a, b) => {
      // Nightly first
      if (a.name.toLowerCase().includes('nightly')) return -1;
      if (b.name.toLowerCase().includes('nightly')) return 1;
      return 0;
    });

  const handleConnect = async (walletName: string) => {
    setIsConnecting(walletName);
    try {
      await connect(walletName);
      onClose();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsConnecting(null);
    }
  };

  // If already connected, just render children
  if (connected) {
    return <>{children}</>;
  }

  return (
    <>
      <div onClick={onOpen}>{children}</div>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Connect Wallet</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={3}>
              <Text color="gray.600" fontSize="sm" textAlign="center" mb={2}>
                Connect your wallet to interact with Movement blockchain.
              </Text>

              {availableWallets.length > 0 ? (
                availableWallets.map((wallet) => (
                  <Button
                    key={wallet.name}
                    width="100%"
                    size="lg"
                    variant="outline"
                    onClick={() => handleConnect(wallet.name)}
                    isLoading={isConnecting === wallet.name}
                    loadingText="Connecting..."
                    leftIcon={
                      wallet.icon ? (
                        <Image
                          src={wallet.icon}
                          alt={wallet.name}
                          boxSize="24px"
                          borderRadius="sm"
                          fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHJ4PSI2IiBmaWxsPSIjOUI4QkI5Ii8+PC9zdmc+"
                        />
                      ) : undefined
                    }
                  >
                    {wallet.name}
                  </Button>
                ))
              ) : (
                <VStack spacing={3} py={4}>
                  <Text color="gray.500" textAlign="center">
                    No compatible wallets detected.
                  </Text>
                  <Button
                    as="a"
                    href="https://nightly.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    colorScheme="purple"
                    size="md"
                  >
                    Install Nightly Wallet
                  </Button>
                </VStack>
              )}

              <Text color="gray.500" fontSize="xs" textAlign="center" mt={2}>
                We recommend Nightly Wallet for the best Movement experience.
              </Text>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
