import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';

import { Theme } from '@astryxdesign/core/theme';
import { defaultThemeSlug, themes } from './astryx-themes';

import DashboardPage from './pages/dashboard';
import ConsentPage from './pages/consent';

const root = document.getElementById('root');
const queryClient = new QueryClient();

if (!root) {
  throw new Error('Missing root element');
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Theme theme={themes[defaultThemeSlug]}>
        {window.location.pathname.startsWith('/consent') ? <ConsentPage /> : <DashboardPage />}
      </Theme>
    </QueryClientProvider>
  </StrictMode>,
);
