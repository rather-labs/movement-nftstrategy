'use client';

import { Box, Container, Flex, Link, IconButton, useColorMode, Image } from '@chakra-ui/react';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import { useMemo } from 'react';
import { ConnectWalletButton } from './ConnectWallet';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { MODULE_ADDRESS } from '@/constants/contracts';

export const Navbar = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const currentAddress = useCurrentAddress();

  // Check if current user is the contract deployer (admin)
  const isAdmin = useMemo(() => {
    if (!currentAddress) return false;
    return currentAddress.toLowerCase() === MODULE_ADDRESS.toLowerCase();
  }, [currentAddress]);

  return (
    <Box as="nav" bg="bg.surface" boxShadow="sm">
      <Container maxW="container.xl">
        <Flex justify="space-between" h={16} align="center">
          <Flex align="center" gap={3}>
            <Link href="/" _hover={{ opacity: 0.8 }} transition="opacity 0.2s">
              <Image
                src={colorMode === 'dark' ? '/images/rather-white.svg' : '/images/rather-dark.svg'}
                alt="RATHER Labs"
                height="35px"
                width="auto"
              />
            </Link>
            <Box height="30px" width="1px" bg="border.default" />
            <Link href="/" textDecoration="none" _hover={{ opacity: 0.8 }}>
              <Box fontSize="lg" fontWeight="bold" color="text.primary">
                Strategy Protocol
              </Box>
            </Link>
          </Flex>
          <Flex align="center" gap={6}>
            <Link href="/strategy">
              <Box>Dashboard</Box>
            </Link>
            <Link href="/marketplace">
              <Box>Marketplace</Box>
            </Link>
            <Link href="/liquidity">
              <Box>Liquidity Pool</Box>
            </Link>
            {isAdmin && (
              <Link href="/admin">
                <Box>Admin</Box>
              </Link>
            )}
            <IconButton
              aria-label="Toggle color mode"
              icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
              onClick={toggleColorMode}
              variant="ghost"
              size="sm"
            />
            <ConnectWalletButton />
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
};
