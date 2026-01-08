'use client';

import { ReactNode, useEffect, useRef } from 'react';
import {
  AptosWalletAdapterProvider,
  useWallet as useAptosWallet,
} from '@aptos-labs/wallet-adapter-react';
import type { AvailableWallets } from '@aptos-labs/wallet-adapter-react';
import { AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { MOVEMENT_TESTNET_RPC } from '@/constants/network';

// Re-export InputTransactionData type for compatibility
export type InputTransactionData = {
  data: {
    function: string;
    typeArguments?: string[];
    functionArguments?: (string | number | boolean | bigint | undefined)[];
  };
  options?: {
    maxGasAmount?: number;
    gasUnitPrice?: number;
  };
};

interface WalletProviderProps {
  children: ReactNode;
}

// Movement Testnet configuration
const movementTestnetConfig = new AptosConfig({
  network: Network.TESTNET,
  fullnode: MOVEMENT_TESTNET_RPC,
  // indexer: MOVEMENT_TESTNET_INDEXER,
});

// Opt-in only to wallets that support custom Movement networks
const supportedWallets: AvailableWallets[] = ['Nightly', 'Petra', 'Pontem Wallet'];

/**
 * Wallet Provider using official Aptos Wallet Adapter
 * Configured for Movement Testnet with autoConnect enabled
 */
export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      optInWallets={supportedWallets}
      dappConfig={movementTestnetConfig}
      onError={(error) => {
        console.error('Wallet error:', error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}

/**
 * Custom hook that wraps the Aptos wallet adapter with a consistent interface
 * Includes fallback auto-connect logic for cases where the adapter's auto-connect fails
 */
export function useWallet() {
  const walletContext = useAptosWallet();
  const autoConnectAttempted = useRef(false);

  const {
    connected,
    account,
    network,
    wallet,
    wallets,
    connect,
    disconnect,
    signAndSubmitTransaction: aptosSignAndSubmit,
  } = walletContext;

  // Check if connecting (wallet state includes isLoading or similar)
  const connecting =
    'isLoading' in walletContext
      ? (walletContext as unknown as { isLoading: boolean }).isLoading
      : false;

  // Fallback auto-connect: if adapter didn't auto-connect, try manually
  useEffect(() => {
    if (autoConnectAttempted.current || connected || connecting) {
      return;
    }

    // Wait for wallets to be detected
    if (!wallets || wallets.length === 0) {
      return;
    }

    autoConnectAttempted.current = true;

    const savedWalletName = localStorage.getItem('AptosWalletName');
    if (!savedWalletName) {
      return;
    }

    // Check if the saved wallet is available
    const savedWallet = wallets.find((w) => w.name === savedWalletName);
    if (savedWallet) {
      // Small delay to let the adapter settle
      const timer = setTimeout(() => {
        if (!connected) {
          console.log('Fallback auto-connect to:', savedWalletName);
          try {
            connect(savedWalletName);
          } catch (err) {
            console.error('Fallback auto-connect failed:', err);
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [connected, connecting, wallets, connect]);

  // Wrap signAndSubmitTransaction to match our expected interface
  const signAndSubmitTransaction = async (
    payload: InputTransactionData
  ): Promise<{ hash: string }> => {
    if (!connected) {
      throw new Error('Wallet not connected');
    }

    const response = await aptosSignAndSubmit({
      data: {
        function: payload.data.function as `${string}::${string}::${string}`,
        typeArguments: payload.data.typeArguments || [],
        functionArguments: payload.data.functionArguments || [],
      },
    });

    return { hash: response.hash };
  };

  return {
    connected,
    connecting,
    account,
    network,
    wallet,
    wallets,
    connect,
    disconnect,
    signAndSubmitTransaction,
  };
}
