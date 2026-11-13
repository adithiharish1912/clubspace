import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { PaymentProvider } from './context/PaymentContext';
import './index.css';

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
