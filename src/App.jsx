import { AuthProvider } from './context/AuthContext';
import AppShell from './router/AppShell';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { ShimmerStyles } from './components/ui/Shimmer';

export default function App() {
  return (
    <AuthProvider>
      <ShimmerStyles />
      <AppShell />
      <PWAInstallPrompt />
    </AuthProvider>
  );
}
