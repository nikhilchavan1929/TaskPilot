import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { AuthProvider } from './features/auth/AuthContext';
import { AuthAbilityProvider } from './features/auth/AuthAbilityProvider';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <AuthAbilityProvider>
        <RouterProvider router={router} />
      </AuthAbilityProvider>
    </AuthProvider>
  </StrictMode>,
);
