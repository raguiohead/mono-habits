import { Capacitor } from '@capacitor/core';
import type { Analytics } from 'firebase/analytics';
import { getFirebaseApp } from './firebase';
import { firebaseConfig } from './firebaseConfig';
import { isDoNotTrack, sanitizeUsageEvent } from './usage';

let analytics: Analytics | null = null;
let enabled = false;
let loading: Promise<Analytics | null> | null = null;

/** Só no navegador/PWA: no app Android (WebView) o Analytics web não funciona */
const available = () => !Capacitor.isNativePlatform() && Boolean(firebaseConfig.measurementId) && Boolean(getFirebaseApp());

async function load(): Promise<Analytics | null> {
  if (analytics) return analytics;
  if (!loading) {
    loading = (async () => {
      try {
        const mod = await import('firebase/analytics');
        if (!(await mod.isSupported())) return null;
        const app = getFirebaseApp();
        if (!app) return null;
        analytics = mod.getAnalytics(app);
        return analytics;
      } catch {
        return null;
      }
    })();
  }
  return loading;
}

/**
 * Liga/desliga a coleta. Desligado: nada é carregado nem enviado (o script do Google nem é baixado).
 * Ligado depois de ter sido ligado antes, a coleta é retomada.
 */
export async function setUsageEnabled(value: boolean): Promise<void> {
  const allow = value && available() && !isDoNotTrack(typeof navigator !== 'undefined' ? navigator : undefined);
  enabled = allow;
  if (!allow) {
    if (analytics) {
      const mod = await import('firebase/analytics');
      mod.setAnalyticsCollectionEnabled(analytics, false);
    }
    return;
  }
  const instance = await load();
  if (!instance) return;
  const mod = await import('firebase/analytics');
  mod.setAnalyticsCollectionEnabled(instance, true);
}

/** Registra um evento da lista fechada; sem consentimento não faz nada */
export function logUsage(name: string, params?: Record<string, unknown>): void {
  if (!enabled || !analytics) return;
  const event = sanitizeUsageEvent(name, params);
  if (!event) return;
  const instance = analytics;
  const send = (mod: typeof import('firebase/analytics')) =>
    (mod.logEvent as (a: Analytics, name: string, params?: Record<string, string>) => void)(instance, event.name, event.params);
  void import('firebase/analytics').then(send);
}
