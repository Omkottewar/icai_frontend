import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import AppShell from './router/AppShell';
import PWAInstallPrompt from './components/PWAInstallPrompt';

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppShell />
        <PWAInstallPrompt />
      </LanguageProvider>
    </AuthProvider>
  );
}
