import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Default to home if no hash
if (!window.location.hash) window.location.hash = '#/';

// When the service worker fires a push-notification click, it postMessages
// us with { type: 'navigate', url } so we can route inside the running app
// instead of doing a full page reload. URLs starting with '#' are treated
// as hash routes; absolute URLs trigger a window.location swap.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'navigate' || typeof msg.url !== 'string') return;
    if (msg.url.startsWith('#') || msg.url.startsWith('/#')) {
      window.location.hash = msg.url.replace(/^\/?#/, '');
    } else if (msg.url.startsWith('/')) {
      window.location.hash = msg.url;
    } else {
      window.location.href = msg.url;
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
