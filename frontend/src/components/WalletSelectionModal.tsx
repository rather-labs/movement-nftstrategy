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
  Image,
  useDisclosure,
  HStack,
  Link,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';

interface WalletSelectionModalProps {
  children: React.ReactNode;
}

const NIGHTLY_ICON =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMUIxQjFGIi8+PHBhdGggZD0iTTggMTBDOCA4Ljg5NTQzIDguODk1NDMgOCAxMCA4SDIyQzIzLjEwNDYgOCAyNCA4Ljg5NTQzIDI0IDEwVjIyQzI0IDIzLjEwNDYgMjMuMTA0NiAyNCAyMiAyNEgxMEM4Ljg5NTQzIDI0IDggMjMuMTA0NiA4IDIyVjEwWiIgZmlsbD0iIzZFNTZDRiIvPjwvc3ZnPg==';

/**
 * Wallet selection modal - Nightly only
 * Shows Nightly wallet connection or install prompt
 */
export function WalletSelectionModal({ children }: WalletSelectionModalProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { wallets = [], connect, connected } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);

  // Find Nightly wallet
  const nightlyWallet = wallets.find((w) => w.name === 'Nightly');
  const isNightlyInstalled = !!nightlyWallet;

  const handleConnect = async () => {
    if (!isNightlyInstalled) {
      // Open Nightly website
      window.open('https://nightly.app', '_blank');
      return;
    }

    setIsConnecting(true);
    try {
      await connect('Nightly');
      onClose();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

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

              <Button
                width="100%"
                size="lg"
                colorScheme={isNightlyInstalled ? 'purple' : 'gray'}
                variant={isNightlyInstalled ? 'solid' : 'outline'}
                onClick={handleConnect}
                isLoading={isConnecting}
                loadingText="Connecting..."
                leftIcon={
                  <Image
                    src={nightlyWallet?.icon || NIGHTLY_ICON}
                    alt="Nightly"
                    boxSize="24px"
                    borderRadius="md"
                  />
                }
              >
                {isNightlyInstalled ? 'Connect Nightly' : 'Install Nightly'}
              </Button>

              {!isNightlyInstalled && (
                <VStack spacing={2} pt={2}>
                  <Text color="gray.500" fontSize="xs" textAlign="center">
                    Nightly wallet is required for Movement Network.
                  </Text>
                  <Link
                    href="https://nightly.app"
                    isExternal
                    color="purple.500"
                    fontSize="sm"
                  >
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
