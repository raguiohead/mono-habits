const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { dueReminder, countPending, reminderBody } = require('./lib/reminders');

initializeApp();

// Deve coincidir com VITE_APP_ID do app (padrão: mono-habit-tracker)
const APP_ID = process.env.APP_ID || 'mono-habit-tracker';
const STALE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token'
]);

/**
 * Roda a cada 5 minutos e envia o lembrete diário por push para quem o ativou,
 * respeitando o horário e o fuso escolhidos (artifacts/{appId}/users/{uid}/prefs/notifications).
 */
exports.sendDailyReminders = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'UTC', region: 'southamerica-east1', maxInstances: 1 },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const snap = await db.collectionGroup('prefs').where('reminderEnabled', '==', true).get();
    const prefix = `artifacts/${APP_ID}/users/`;

    for (const prefDoc of snap.docs) {
      try {
        if (prefDoc.id !== 'notifications' || !prefDoc.ref.path.startsWith(prefix)) continue;
        const due = dueReminder({ now, prefs: prefDoc.data() });
        if (!due) continue;

        const userRef = prefDoc.ref.parent.parent;
        const [habitsSnap, logSnap, tokensSnap] = await Promise.all([
          userRef.collection('habits').get(),
          userRef.collection('logs').doc(due.dateKey).get(),
          userRef.collection('fcmTokens').get()
        ]);

        const habits = habitsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const pending = countPending(habits, logSnap.data()?.completedHabitIds, due.weekday);
        // Marca o dia como tratado mesmo sem pendências, para não reavaliar a cada execução
        await prefDoc.ref.set({ lastSentKey: due.dateKey }, { merge: true });
        if (pending <= 0 || tokensSnap.empty) continue;

        const tokens = tokensSnap.docs.map((d) => d.id);
        const res = await getMessaging().sendEachForMulticast({
          tokens,
          notification: { title: 'MONO // HABITS', body: reminderBody(pending) },
          webpush: {
            notification: { icon: '/icon-192.png', badge: '/icon-192.png', tag: 'daily-reminder' },
            fcmOptions: { link: '/' }
          }
        });

        // Remove tokens inválidos (app desinstalado, permissão revogada)
        await Promise.all(
          res.responses.map((r, i) =>
            !r.success && STALE_TOKEN_CODES.has(r.error?.code) ? tokensSnap.docs[i].ref.delete() : null
          )
        );
      } catch (error) {
        console.error('[reminders] Falha ao processar', prefDoc.ref.path, error);
      }
    }
  }
);
