import { AuthProvider } from './context/AuthContext';
import AppShell from './router/AppShell';
import PWAInstallPrompt from './components/PWAInstallPrompt';

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
      <PWAInstallPrompt />
    </AuthProvider>
  );
}
