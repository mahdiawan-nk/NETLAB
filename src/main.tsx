import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// In AI Studio preview environment, HMR is disabled. Suppress stray WebSocket closed errors.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (msg.includes('WebSocket') || msg.includes('vite') || msg.includes('ws://') || msg.includes('wss://')) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
