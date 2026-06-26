import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import AppShell from './router/AppShell';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { ShimmerStyles } from './components/ui/Shimmer';
import ToastProvider from './components/ui/Toast';
import ConfirmDialogProvider from './components/ui/ConfirmDialog';
import { installLinkPrefetchListener } from './lib/routePrefetch';

export default function App() {
  // One delegated listener prefetches a route's JS chunk the moment the
  // cursor enters (or keyboard focuses, or a touch begins on) any
  // <a href="#/..."> in the page. By the time the click resolves the chunk
  // is usually already parsed, so navigation feels instant.
  useEffect(() => { installLinkPrefetchListener(); }, []);

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <AuthProvider>
          <ShimmerStyles />
          <AppShell />
          <PWAInstallPrompt />
        </AuthProvider>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
