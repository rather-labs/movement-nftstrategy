'use client';

import { ReactNode, useState, useEffect, createContext, useContext, useCallback } from 'react';
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

// Minimal wallet interface
interface WalletInfo {
  name: string;
  icon?: string;
}

interface WalletAccount {
  address: string;
  publicKey?: string;
}

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  account: { address: { toString: () => string } } | null;
  network: { name: string } | null;
  wallets: WalletInfo[];
  connect: (walletName: string) => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSubmitTransaction: (payload: InputTransactionData) => Promise<{ hash: string }>;
}

const WalletContext = createContext<WalletContextType | null>(null);

interface WalletProviderProps {
  children: ReactNode;
}

/**
 * Custom Wallet Provider for Movement network
 * Avoids AptosConnect SDK wallets that don't support custom networks
 */
export function WalletProvider({ children }: WalletProviderProps) {
  const [mounted, setMounted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState<{ address: { toString: () => string } } | null>(null);
  const [network, setNetwork] = useState<{ name: string } | null>(null);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [nightlyWallet, setNightlyWallet] = useState<any>(null);

  useEffect(() => {
    setMounted(true);

    // Detect Nightly wallet
    const detectWallets = () => {
      const detected: WalletInfo[] = [];

      // Check for Nightly wallet
      if (typeof window !== 'undefined' && (window as any).nightly?.aptos) {
        const nightlyAptos = (window as any).nightly.aptos;
        detected.push({
          name: 'Nightly',
          // Use the wallet's own icon if available, otherwise use a fallback
          icon:
            nightlyAptos.icon ||
            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHJ4PSI2IiBmaWxsPSIjNkU0MUU2Ii8+PHBhdGggZD0iTTEyIDZDOC42ODYgNiA2IDguNjg2IDYgMTJDNiAxNS4zMTQgOC42ODYgMTggMTIgMThDMTUuMzE0IDE4IDE4IDE1LjMxNCAxOCAxMkMxOCA4LjY4NiAxNS4zMTQgNiAxMiA2WiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=',
        });
        setNightlyWallet(nightlyAptos);
      }

      // Check for Petra wallet
      if (typeof window !== 'undefined' && (window as any).petra) {
        detected.push({
          name: 'Petra',
          icon: 'https://petra.app/favicon.ico',
        });
      }

      // Check for Pontem wallet
      if (typeof window !== 'undefined' && (window as any).pontem) {
        detected.push({
          name: 'Pontem',
          icon: 'https://pontem.network/favicon.ico',
        });
      }

      setWallets(detected);
    };

    // Delay detection to ensure wallets are injected
    const timer = setTimeout(detectWallets, 100);
    return () => clearTimeout(timer);
  }, []);

  const connect = useCallback(
    async (walletName: string) => {
      setConnecting(true);
      try {
        if (walletName === 'Nightly' && nightlyWallet) {
          const response = await nightlyWallet.connect();
          if (response?.address) {
            setAccount({
              address: {
                toString: () => response.address,
              },
            });
            setConnected(true);

            // Get network info from wallet
            try {
              const networkInfo = await nightlyWallet.network?.();
              console.log('Nightly network info:', networkInfo);
              if (networkInfo) {
                // Extract network name - handle various formats
                let networkName = 'Testnet';
                if (typeof networkInfo === 'string') {
                  networkName = networkInfo;
                } else if (typeof networkInfo.name === 'string') {
                  networkName = networkInfo.name;
                } else if (typeof networkInfo.chainId === 'number') {
                  // Movement Bardock Testnet chainId = 250
                  networkName = networkInfo.chainId === 250 ? 'Testnet' : 'Mainnet';
                }

                const isTestnet =
                  networkName.toLowerCase().includes('testnet') ||
                  networkName.toLowerCase().includes('bardock') ||
                  networkName.toLowerCase().includes('movement');
                setNetwork({ name: isTestnet ? 'Testnet' : networkName });
              } else {
                setNetwork({ name: 'Testnet' });
              }
            } catch (e) {
              console.log('Failed to get network:', e);
              setNetwork({ name: 'Testnet' });
            }
          }
        } else if (walletName === 'Petra' && (window as any).petra) {
          const petra = (window as any).petra;
          const response = await petra.connect();
          if (response?.address) {
            setAccount({
              address: {
                toString: () => response.address,
              },
            });
            setConnected(true);

            // Get network info from Petra
            try {
              const networkInfo = await petra.network?.();
              if (networkInfo) {
                const networkName = networkInfo.name || networkInfo;
                const isTestnet =
                  typeof networkName === 'string' && networkName.toLowerCase().includes('testnet');
                setNetwork({ name: isTestnet ? 'Testnet' : networkName });
              } else {
                setNetwork({ name: 'Testnet' });
              }
            } catch {
              setNetwork({ name: 'Testnet' });
            }
          }
        }
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        throw error;
      } finally {
        setConnecting(false);
      }
    },
    [nightlyWallet]
  );

  const disconnect = useCallback(async () => {
    try {
      if (nightlyWallet) {
        await nightlyWallet.disconnect?.();
      }
      if ((window as any).petra) {
        await (window as any).petra.disconnect?.();
      }
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
    setAccount(null);
    setConnected(false);
    setNetwork(null);
  }, [nightlyWallet]);

  const signAndSubmitTransaction = useCallback(
    async (payload: InputTransactionData): Promise<{ hash: string }> => {
      if (!connected) {
        throw new Error('Wallet not connected');
      }

      // Format the transaction for the wallet
      const tx = {
        function: payload.data.function,
        type_arguments: payload.data.typeArguments || [],
        arguments: payload.data.functionArguments || [],
      };

      try {
        if (nightlyWallet) {
          const response = await nightlyWallet.signAndSubmitTransaction(tx);
          return { hash: response.hash || response };
        }
        if ((window as any).petra) {
          const response = await (window as any).petra.signAndSubmitTransaction(tx);
          return { hash: response.hash || response };
        }
        throw new Error('No wallet available');
      } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
      }
    },
    [connected, nightlyWallet]
  );

  const value: WalletContextType = {
    connected,
    connecting,
    account,
    network,
    wallets,
    connect,
    disconnect,
    signAndSubmitTransaction,
  };

  if (!mounted) {
    // Return a minimal context during SSR
    return (
      <WalletContext.Provider
        value={{
          connected: false,
          connecting: false,
          account: null,
          network: null,
          wallets: [],
          connect: async () => {},
          disconnect: async () => {},
          signAndSubmitTransaction: async () => ({ hash: '' }),
        }}
      >
        {children}
      </WalletContext.Provider>
    );
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
