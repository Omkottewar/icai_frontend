import { AuthProvider } from './context/AuthContext';
import AppShell from './router/AppShell';

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
