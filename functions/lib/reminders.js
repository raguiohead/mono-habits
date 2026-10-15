// Lógica pura do lembrete diário (sem dependência do Firebase), testável isoladamente.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Janela (min) após o horário escolhido em que o lembrete ainda pode ser enviado. */
const WINDOW_MINUTES = 120;

/** Data/hora local (YYYY-MM-DD, dia da semana 0-6, minutos desde 00:00) em um fuso IANA. */
function localParts(now, timeZone) {
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23'
    });
  } catch {
    return null; // fuso inválido
  }
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    weekday,
    minutes: Number(p.hour) * 60 + Number(p.minute)
  };
}

/**
 * Decide se o lembrete deve ser enviado agora para um usuário.
 * Retorna { dateKey, weekday } quando devido, ou null.
 */
function dueReminder({ now, prefs }) {
  if (!prefs || prefs.reminderEnabled !== true || !TIME_RE.test(prefs.reminderTime || '')) return null;
  const local = localParts(now, prefs.timezone || 'UTC');
  if (!local || local.weekday < 0) return null;
  if (prefs.lastSentKey === local.dateKey) return null;
  const [h, m] = prefs.reminderTime.split(':').map(Number);
  const delta = local.minutes - (h * 60 + m);
  if (delta < 0 || delta > WINDOW_MINUTES) return null;
  return { dateKey: local.dateKey, weekday: local.weekday };
}

/** Quantidade de hábitos de hoje ainda não concluídos. */
function countPending(habits, completedIds, weekday) {
  const done = new Set(completedIds || []);
  return habits.filter(
    (h) => !h.archived && Array.isArray(h.frequency) && h.frequency.includes(weekday) && !done.has(h.id)
  ).length;
}

/** Texto igual ao do lembrete local; não inclui nomes de hábitos (Modo Discreto). */
function reminderBody(pending) {
  return pending === 1 ? 'Falta 1 hábito para hoje.' : `Faltam ${pending} hábitos para hoje.`;
}

module.exports = { dueReminder, countPending, reminderBody, localParts, WINDOW_MINUTES };
