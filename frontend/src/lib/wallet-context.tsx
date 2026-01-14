'use client';

import { ReactNode, useEffect, useCallback, useRef } from 'react';
import {
  AptosWalletAdapterProvider,
  useWallet as useAptosWallet,
} from '@aptos-labs/wallet-adapter-react';
import { getAptosWallets } from '@aptos-labs/wallet-standard';
import { Network } from '@aptos-labs/ts-sdk';

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

// Movement Network configuration
const MOVEMENT_NETWORK_INFO = {
  chainId: 250, // Movement Testnet
  name: Network.CUSTOM,
  url: 'https://testnet.movementnetwork.xyz/v1',
};

// Local storage key for wallet name (used by Aptos wallet adapter)
const WALLET_NAME_KEY = 'AptosWalletName';

/**
 * Wallet Provider using official Aptos Wallet Adapter
 * Configured for Movement Network with Nightly wallet only
 *
 * autoConnect uses localStorage key 'AptosWalletName' to persist wallet selection
 * The wallet (Nightly) handles the network connection to Movement
 *
 * Note: We use Network.TESTNET in dappConfig to prevent AptosConnect from crashing
 * (it doesn't support CUSTOM networks). Nightly wallet ignores this and connects
 * to whatever network is configured in the wallet itself (Movement Testnet).
 */
export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      optInWallets={['Nightly', 'Pontem Wallet']}
      dappConfig={{
        network: Network.TESTNET,
        aptosConnectDappId: undefined, // Disable AptosConnect (doesn't support custom networks)
      }}
      onError={(error) => {
        console.error('Wallet error:', error);
      }}
    >
      <WalletAutoReconnect>{children}</WalletAutoReconnect>
    </AptosWalletAdapterProvider>
  );
}

/**
 * Inner component that handles auto-reconnection with proper network info
 * This ensures wallet stays connected across page navigations
 */
function WalletAutoReconnect({ children }: { children: ReactNode }) {
  const { connected, account, connect, wallet } = useAptosWallet();
  const hasAttemptedReconnect = useRef(false);
  const isReconnecting = useRef(false);

  const attemptDirectConnect = useCallback(async (walletName: string) => {
    if (typeof window === 'undefined') return false;

    try {
      const allWallets = getAptosWallets();
      const selectedWallet = allWallets.aptosWallets.find((w) => w.name === walletName);

      if (selectedWallet?.features?.['aptos:connect']) {
        // Connect directly with Movement Network info
        const result = await selectedWallet.features['aptos:connect'].connect(
          true, // silent reconnect
          MOVEMENT_NETWORK_INFO
        );

        return result.status === 'Approved';
      }
    } catch (error) {
      console.warn('Direct wallet connection failed:', error);
    }
    return false;
  }, []);

  // Handle auto-reconnection on mount and page changes
  useEffect(() => {
    const reconnectWallet = async () => {
      // Skip if already connected, currently reconnecting, or already attempted
      if (connected || isReconnecting.current || hasAttemptedReconnect.current) {
        return;
      }

      // Check if we have a saved wallet name
      const savedWalletName = localStorage.getItem(WALLET_NAME_KEY);
      if (!savedWalletName) {
        hasAttemptedReconnect.current = true;
        return;
      }

      // Clean the wallet name (remove quotes if present)
      const walletName = savedWalletName.replace(/^"|"$/g, '');

      isReconnecting.current = true;

      try {
        // First, try direct connection with network info for better persistence
        const directSuccess = await attemptDirectConnect(walletName);

        if (directSuccess) {
          // Call the adapter's connect to sync state
          connect(walletName);
        } else {
          // Fallback to regular adapter connect
          connect(walletName);
        }
      } catch (error) {
        console.warn('Auto-reconnect failed:', error);
      } finally {
        isReconnecting.current = false;
        hasAttemptedReconnect.current = true;
      }
    };

    // Small delay to ensure wallet adapter is ready
    const timeoutId = setTimeout(reconnectWallet, 100);
    return () => clearTimeout(timeoutId);
  }, [connected, connect, attemptDirectConnect]);

  // Reset reconnect flag when wallet disconnects
  useEffect(() => {
    if (!connected && !account) {
      hasAttemptedReconnect.current = false;
    }
  }, [connected, account]);

  return <>{children}</>;
}

/**
 * Custom hook that wraps the Aptos wallet adapter with a simplified interface
 * Includes enhanced connection handling for Movement Network
 */
export function useWallet() {
  const {
    connected,
    account,
    network,
    wallet,
    wallets,
    connect: adapterConnect,
    disconnect,
    signAndSubmitTransaction: aptosSignAndSubmit,
    isLoading,
  } = useAptosWallet();

  /**
   * Enhanced connect function that uses direct wallet connection with Movement Network info
   * This ensures proper network configuration and better connection persistence
   */
  const connect = useCallback(
    async (walletName: string) => {
      if (typeof window === 'undefined') {
        adapterConnect(walletName);
        return;
      }

      try {
        const allWallets = getAptosWallets();
        const selectedWallet = allWallets.aptosWallets.find((w) => w.name === walletName);

        if (selectedWallet?.features?.['aptos:connect']) {
          // Connect directly with Movement Network info for better persistence
          const result = await selectedWallet.features['aptos:connect'].connect(
            true,
            MOVEMENT_NETWORK_INFO
          );

          if (result.status === 'Approved') {
            // Sync with adapter state
            adapterConnect(walletName);
            return;
          }
        }
      } catch (error) {
        console.warn('Direct connection failed, falling back to adapter:', error);
      }

      // Fallback to standard adapter connect
      adapterConnect(walletName);
    },
    [adapterConnect]
  );

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
    connecting: isLoading,
    account,
    network,
    wallet,
    wallets,
    connect,
    disconnect,
    signAndSubmitTransaction,
  };
}
