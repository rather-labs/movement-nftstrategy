'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Flex,
  Tag,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  IconButton,
  Link,
  useToast,
  Box,
  Text,
  Skeleton,
  type ButtonProps,
} from '@chakra-ui/react';
import { ChevronDownIcon, ExternalLinkIcon, CopyIcon } from '@chakra-ui/icons';
import { useWallet } from '@/lib/wallet-context';
import { WalletSelectionModal } from './WalletSelectionModal';
import { getAccountExplorerLink } from '@/utils/explorer-links';
import { getAptosClient } from '@/lib/movement-client';

type ConnectWalletButtonProps = ButtonProps & { children?: React.ReactNode };

export const ConnectWalletButton = (buttonProps: ConnectWalletButtonProps) => {
  const { children } = buttonProps;
  const toast = useToast();
  const { account, connected, disconnect, network } = useWallet();
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const currentAddress = account?.address?.toString() || null;

  // Fetch MOVE balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!currentAddress) {
        setBalance(null);
        return;
      }

      setIsLoadingBalance(true);
      try {
        const client = getAptosClient();
        const resources = await client.getAccountResource({
          accountAddress: currentAddress,
          resourceType: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
        });

        const coinValue = (resources as any)?.coin?.value || '0';
        // Convert from octas (8 decimals) to MOVE
        const moveBalance = (Number(coinValue) / 1e8).toFixed(4);
        setBalance(moveBalance);
      } catch (error) {
        console.error('Failed to fetch balance:', error);
        setBalance('0');
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [currentAddress]);

  const copyAddress = () => {
    if (currentAddress) {
      navigator.clipboard.writeText(currentAddress);
      toast({
        title: 'Address copied',
        description: 'Wallet address copied to clipboard',
        status: 'success',
        duration: 2000,
        isClosable: true,
        position: 'bottom-right',
      });
    }
  };

  const truncateMiddle = (str: string | null) => {
    if (!str) return '';
    if (str.length <= 12) return str;
    return `${str.slice(0, 6)}...${str.slice(-4)}`;
  };

  // Check network name for testnet indicators
  let networkName = '';
  if (network?.name) {
    if (typeof network.name === 'string') {
      networkName = network.name;
    } else if (typeof network.name === 'object') {
      networkName = (network.name as any).name || JSON.stringify(network.name);
    }
  }
  const isTestnet =
    networkName.toLowerCase().includes('testnet') ||
    networkName.toLowerCase().includes('bardock') ||
    networkName.toLowerCase().includes('movement') ||
    networkName === 'Testnet';
  const networkLabel = isTestnet ? 'Testnet' : networkName || 'Unknown';
  const networkColor = isTestnet ? 'purple' : 'blue';

  return connected && currentAddress ? (
    <Menu>
      <Flex align="center" gap={0}>
        <Link
          href={getAccountExplorerLink(currentAddress)}
          target="_blank"
          _hover={{ textDecoration: 'none' }}
        >
          <Button
            variant="ghost"
            size="md"
            rightIcon={<ChevronDownIcon visibility="hidden" />}
            _hover={{ bg: 'bg.subtle' }}
          >
            <Flex align="center" gap={2}>
              <Box
                fontSize="sm"
                fontFamily="mono"
                width="140px"
                overflow="hidden"
                textOverflow="ellipsis"
                color="text.primary"
              >
                {truncateMiddle(currentAddress)}
              </Box>
              <Tag size="sm" colorScheme={networkColor} borderRadius="full">
                {networkLabel}
              </Tag>
            </Flex>
          </Button>
        </Link>
        {/* MOVE Balance Indicator */}
        <Box ml={2} px={2} py={1} bg="bg.subtle" borderRadius="md">
          {isLoadingBalance ? (
            <Skeleton height="16px" width="60px" />
          ) : (
            <Text fontSize="sm" fontWeight="medium" color="text.secondary">
              {balance ?? '0'} MOVE
            </Text>
          )}
        </Box>
        <MenuButton
          as={IconButton}
          variant="ghost"
          icon={<ChevronDownIcon />}
          aria-label="Wallet options"
          size="md"
          _hover={{ bg: 'bg.subtle' }}
        />
      </Flex>
      <MenuList>
        <MenuItem icon={<CopyIcon />} onClick={copyAddress}>
          Copy Address
        </MenuItem>
        <MenuItem
          icon={<ExternalLinkIcon />}
          as={Link}
          href={getAccountExplorerLink(currentAddress)}
          target="_blank"
          _hover={{ textDecoration: 'none' }}
        >
          View in Explorer
        </MenuItem>
        <MenuDivider />
        <MenuItem
          onClick={() => disconnect()}
          color="red.500"
          data-testid="disconnect-wallet-address-button"
        >
          Disconnect Wallet
        </MenuItem>
      </MenuList>
    </Menu>
  ) : (
    <WalletSelectionModal>
      <Button size="md" colorScheme="purple" data-testid="wallet-connect-button" {...buttonProps}>
        {children || 'Connect Wallet'}
      </Button>
    </WalletSelectionModal>
  );
};
