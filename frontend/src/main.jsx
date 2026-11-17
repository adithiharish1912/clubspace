import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { PaymentProvider } from './context/PaymentContext';
import './index.css';

// Register the service worker so ClubSpace can be installed as an app on phones and desktops
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Keep the browser's install prompt so the "Install app" button can show it later
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
  window.dispatchEvent(new Event('cs-installable'));
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PaymentProvider>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                className: '!rounded-xl !text-sm !font-medium dark:!bg-ink-700 dark:!text-slate-100',
                success: { iconTheme: { primary: '#2563eb', secondary: '#fff' } },
              }}
            />
          </PaymentProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
