import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AppProvider } from './lib/store';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfigErrorScreen } from './components/ConfigErrorScreen';
import { firebaseConfigError } from './lib/firebase';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {firebaseConfigError ? (
      <ConfigErrorScreen message={firebaseConfigError} />
    ) : (
      <ErrorBoundary>
        <AppProvider>
          <App />
        </AppProvider>
      </ErrorBoundary>
    )}
  </StrictMode>,
);
