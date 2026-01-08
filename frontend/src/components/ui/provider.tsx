'use client';

import { useState } from 'react';
import theme from '@/theme';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletProvider } from '../WalletProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  // Use useState to ensure QueryClient is only created once and persists across re-renders
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <WalletProvider>{children}</WalletProvider>
      </ChakraProvider>
    </QueryClientProvider>
  );
}
