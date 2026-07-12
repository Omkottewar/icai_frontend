import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { installLinkClickInterceptor, navigate } from './hooks/useRoute';
import './styles/index.css';

// Back-compat: anyone landing on a legacy `/#/foo` URL gets transparently
// redirected to `/foo` before React mounts. This covers bookmarks, push
// notifications, and emails sent during the hash-router era. Runs
// synchronously so the SPA boots straight into the right route.
if (window.location.hash.startsWith('#/')) {
  const legacyPath = window.location.hash.slice(1);   // "#/events?x=1" → "/events?x=1"
  window.history.replaceState(null, '', legacyPath);
}

// Install the delegated click interceptor — turns any same-origin
// <a href="/foo"> click into history.pushState instead of a full reload.
installLinkClickInterceptor();

// When the service worker fires a push-notification click, it postMessages
// us with { type: 'navigate', url } so we can route inside the running app
// instead of doing a full page reload. URLs starting with '/' are routed
// in-app; absolute URLs trigger a window.location swap.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'navigate' || typeof msg.url !== 'string') return;
    // Legacy '#/foo' or '/#/foo' shapes from older notifications — strip
    // any leading '/' and '#' so we land on a clean path before routing.
    if (msg.url.startsWith('#') || msg.url.startsWith('/#')) {
      navigate('/' + msg.url.replace(/^\/?#\/?/, ''));
    } else if (msg.url.startsWith('/')) {
      navigate(msg.url);
    } else {
      window.location.href = msg.url;
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
