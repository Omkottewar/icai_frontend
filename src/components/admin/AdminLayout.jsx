import { useMemo } from 'react';
import { useAdminHeader } from './AdminShell';

// Thin shim. Pages keep using <AdminLayout title="..." subtitle="..." actions={...}>
// — but the layout's sidebar + topbar now live in AdminShell (mounted
// once when the admin route is entered). This component just publishes
// title/subtitle/actions to the persistent shell via context and renders
// its children inline, so the admin DOM no longer rebuilds on every
// sidebar click.
//
// Existing pages need no changes.
export default function AdminLayout({ title, subtitle, actions, children }) {
  // Stabilise the header object — the persistent shell's useLayoutEffect
  // depends on identity of `actions` (a JSX element) which can change
  // across renders even when its content is the same. Wrapping in
  // useMemo with primitive deps keeps unnecessary re-renders out.
  const header = useMemo(
    () => ({ title, subtitle, actions }),
    [title, subtitle, actions],
  );
  useAdminHeader(header);
  return children;
}
