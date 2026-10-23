import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/app/App'

;(globalThis as any).__VITE_API_URL__ = import.meta.env.VITE_API_URL

// Catch and recover from Vite chunk fetch errors during new production deployments
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const retryKey = 'psits_vite_preload_ts';
  const lastRetry = sessionStorage.getItem(retryKey);
  const now = Date.now();
  if (!lastRetry || now - Number(lastRetry) > 15000) {
    sessionStorage.setItem(retryKey, String(now));
    const url = new URL(window.location.href);
    url.searchParams.set('_v', now.toString());
    window.location.replace(url.toString());
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
