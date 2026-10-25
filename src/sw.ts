/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';
import { QUEUE_MESSAGE_TYPE, enqueueCompletion } from './lib/completionQueue';
import { firebaseConfig } from './lib/firebaseConfig';

declare const self: ServiceWorkerGlobalScope;

// Atualização automática (registerType: 'autoUpdate'): a versão nova assume sem esperar
void self.skipWaiting();
clientsClaim();

// Precache dos arquivos do build + fallback de navegação para o app de página única
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/_vercel\//, /^\/__\//]
  })
);

/** Ação "Marcar como feito" do lembrete diário */
const COMPLETE_ACTION = 'complete';

interface ReminderData {
  habitId?: unknown;
  dateKey?: unknown;
}

/** Foca o app se já estiver aberto; senão abre */
async function focusOrOpenApp(): Promise<void> {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = windows[0];
  if (existing) {
    await existing.focus();
  } else {
    await self.clients.openWindow('/');
  }
}

/**
 * O SW não acessa o localStorage: grava a conclusão na fila (IndexedDB) e avisa os clientes abertos.
 * Sem cliente aberto, não abre janela: a fila é aplicada no próximo carregamento do app.
 */
async function queueCompletion(habitId: string, dateKey: string): Promise<void> {
  await enqueueCompletion({ habitId, dateKey, at: Date.now() });
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach((client) => client.postMessage({ type: QUEUE_MESSAGE_TYPE }));
}

// Push do Firebase Cloud Messaging (mensagens enviadas pelo Console): com o app em segundo plano, o SDK
// mostra a notificação e trata o clique. É inicializado só quando há chave de mensagens configurada.
if (firebaseConfig.messagingSenderId) {
  try {
    getMessaging(initializeApp(firebaseConfig));
  } catch {
    /* sem push: o resto do Service Worker segue funcionando */
  }
}

self.addEventListener('notificationclick', (event) => {
  // Notificações do FCM têm FCM_MSG nos dados e são tratadas pelo próprio SDK
  if ((event.notification.data as Record<string, unknown> | null)?.FCM_MSG) return;
  event.notification.close();
  const data = (event.notification.data ?? {}) as ReminderData;

  if (event.action === COMPLETE_ACTION && typeof data.habitId === 'string' && typeof data.dateKey === 'string') {
    event.waitUntil(queueCompletion(data.habitId, data.dateKey));
    return;
  }
  event.waitUntil(focusOrOpenApp());
});
