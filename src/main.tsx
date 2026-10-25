import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './index.css';

// No-op Analytics component replacing @vercel/analytics
const Analytics = () => null;

// Registro automático de Service Worker para PWA (offline-ready)
// Não roda no app nativo: o SW no esquema https://localhost do Capacitor conflita com o cache dos assets empacotados
if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] Falha ao registrar Service Worker:', err);
    });
  });
}

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
      <Analytics />
    </React.StrictMode>
  );
}
