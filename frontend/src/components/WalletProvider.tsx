'use client';

import { ReactNode } from 'react';
import { WalletProvider as MovementWalletProvider } from '@/lib/wallet-context';

interface WalletProviderProps {
  children: ReactNode;
}

/**
 * Wallet Provider wrapper component
 * Uses Aptos wallet adapter configured for Movement network
 */
export function WalletProvider({ children }: WalletProviderProps) {
  return <MovementWalletProvider>{children}</MovementWalletProvider>;
}
