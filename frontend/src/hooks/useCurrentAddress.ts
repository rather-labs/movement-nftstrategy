import { useWallet } from '@/lib/wallet-context';

/**
 * Hook to get the current connected wallet address
 * Returns the address as a string or null if not connected
 */
export function useCurrentAddress(): string | null {
  const { account, connected } = useWallet();

  if (!connected || !account?.address) {
    return null;
  }

  return account.address.toString();
}
