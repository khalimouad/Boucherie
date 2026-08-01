import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import { initTheme } from './theme';
import './styles.css';

initTheme();

/* Ask the browser to keep IndexedDB. Without this the store is "best-effort"
   and can be evicted under disk pressure — on a till running with cloud sync
   off, that store is the only copy of the shop's history. Granted silently in
   most cases when the POS runs from its own browser profile. */
void navigator.storage?.persist?.().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
