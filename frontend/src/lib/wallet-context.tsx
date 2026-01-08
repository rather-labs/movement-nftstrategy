'use client';

import { ReactNode } from 'react';
import {
  AptosWalletAdapterProvider,
  useWallet as useAptosWallet,
} from '@aptos-labs/wallet-adapter-react';
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
      optInWallets={['Nightly']}
      dappConfig={{
        network: Network.TESTNET,
      }}
      onError={(error) => {
        console.error('Wallet error:', error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}

/**
 * Custom hook that wraps the Aptos wallet adapter with a simplified interface
 */
export function useWallet() {
  const {
    connected,
    account,
    network,
    wallet,
    wallets,
    connect,
    disconnect,
    signAndSubmitTransaction: aptosSignAndSubmit,
    isLoading,
  } = useAptosWallet();

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
