import { sanitizeMilestonesSeen, type MilestonesSeen } from './milestones';
import { type Habit, type LogsMap, type GracesMap, type SlipsMap, type PomoSession, type PomoKind } from '@/types/habit';
import { sanitizeSlips } from './avoid';
import { sanitizeLockConfig, type LockConfig } from './lock';
import { sanitizeGraces } from './graces';
import { DEFAULT_DURATIONS, clampMinutes, type PomoDurations } from './pomo';
import { DEFAULT_SETTINGS, sanitizeSettings, type AppSettings } from './settings';
import { withSanitizedCover } from './covers';
import { pruneDismissals, type GoalDismissals } from './pomoGoals';

const HABITS_STORAGE_KEY = 'mono_habits_data_v1';
const LOGS_STORAGE_KEY = 'mono_habits_logs_v1';
const THEME_STORAGE_KEY = 'mono_habits_theme_v1';
const SETTINGS_STORAGE_KEY = 'mono_habits_settings_v1';
const WELCOME_KEY = 'mono_habits_welcome_v1';
const REMINDER_SENT_KEY = 'mono_habits_reminder_sent_v1';
const REMINDER_SCHEDULED_TODAY_KEY = 'mono_habits_reminder_sched_v1';
const MILESTONES_SEEN_KEY = 'mono_habits_milestones_seen_v1';
const DAY_COMPLETE_KEY = 'mono_habits_day_complete_v1';
const GOAL_DISMISSED_KEY = 'mono_habits_goal_dismissed_v1';
const GRACES_STORAGE_KEY = 'mono_habits_graces_v1';
const SLIPS_STORAGE_KEY = 'mono_habits_slips_v1';
const LOCK_STORAGE_KEY = 'mono_habits_lock_v1';
const LAST_SYNCED_UID_KEY = 'mono_habits_last_uid_v1';

export const DEFAULT_HABITS: Habit[] = [
  {
    id: 'habit-1',
    title: 'Ler 20 páginas de um livro',
    category: 'Intelecto',
    icon: 'book',
    hideTitle: false,
    frequency: [0, 1, 2, 3, 4, 5, 6],
    archived: false,
    createdAt: Date.now() - 86400000 * 14
  },
  {
    id: 'habit-2',
    title: 'Treino de força / Mobilidade',
    category: 'Saúde',
    icon: 'dumbbell',
    hideTitle: false,
    frequency: [1, 2, 3, 4, 5],
    archived: false,
    createdAt: Date.now() - 86400000 * 14
  },
  {
    id: 'habit-3',
    title: 'Beber 3L de água',
    category: 'Saúde',
    icon: 'droplets',
    hideTitle: false,
    frequency: [0, 1, 2, 3, 4, 5, 6],
    archived: false,
    createdAt: Date.now() - 86400000 * 14
  },
  {
    id: 'habit-4',
    title: 'Sessão de foco profundo (90 min)',
    category: 'Trabalho',
    icon: 'target',
    hideTitle: false,
    frequency: [1, 2, 3, 4, 5],
    archived: false,
    createdAt: Date.now() - 86400000 * 14
  }
];

export function getStoredTheme(): boolean {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val !== null) {
      return val === 'dark';
    }
    // Preferência do sistema
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true; // Padrão dark mode
  }
}

export function setStoredTheme(isDark: boolean): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  } catch (e) {
    console.warn('Falha ao salvar tema no localStorage', e);
  }
}

export function loadLocalHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(HABITS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(withSanitizedCover) : [];
  } catch (error) {
    console.error('Falha ao carregar hábitos do localStorage:', error);
    return [];
  }
}

/** Retorna false quando não coube (ex.: QuotaExceededError); o valor anterior permanece intacto */
export function saveLocalHabits(habits: Habit[]): boolean {
  try {
    localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
    return true;
  } catch (error) {
    console.error('Falha ao salvar hábitos no localStorage:', error);
    return false;
  }
}

export function loadLocalLogs(): LogsMap {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Falha ao carregar logs do localStorage:', error);
    return {};
  }
}

export function saveLocalLogs(logs: LogsMap): void {
  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Falha ao salvar logs no localStorage:', error);
  }
}

// ---------- Bloqueio do app (PIN / biometria) ----------

/** Fica só neste aparelho e NÃO entra na exportação: guarda hash+sal do PIN, nunca o PIN */
export function loadLockConfig(): LockConfig {
  try {
    const raw = localStorage.getItem(LOCK_STORAGE_KEY);
    return sanitizeLockConfig(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeLockConfig(null);
  }
}

export function saveLockConfig(config: LockConfig): void {
  try {
    localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Falha ao salvar o bloqueio no localStorage:', error);
  }
}

// ---------- Escorregões (hábitos a evitar) ----------

export function loadLocalSlips(): SlipsMap {
  try {
    const raw = localStorage.getItem(SLIPS_STORAGE_KEY);
    return raw ? sanitizeSlips(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveLocalSlips(slips: SlipsMap): void {
  try {
    localStorage.setItem(SLIPS_STORAGE_KEY, JSON.stringify(slips));
  } catch (error) {
    console.error('Falha ao salvar escorregões no localStorage:', error);
  }
}

// ---------- Dias de graça ----------

export function loadLocalGraces(): GracesMap {
  try {
    const raw = localStorage.getItem(GRACES_STORAGE_KEY);
    return raw ? sanitizeGraces(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveLocalGraces(graces: GracesMap): void {
  try {
    localStorage.setItem(GRACES_STORAGE_KEY, JSON.stringify(graces));
  } catch (error) {
    console.error('Falha ao salvar dias de graça no localStorage:', error);
  }
}

// ---------- Metas do Pomo ----------

/** Hábitos desmarcados manualmente no dia: o Pomo não os remarca automaticamente (só neste aparelho) */
export function loadGoalDismissals(): GoalDismissals {
  try {
    const raw = localStorage.getItem(GOAL_DISMISSED_KEY);
    return raw ? pruneDismissals(JSON.parse(raw), new Date()) : {};
  } catch {
    return {};
  }
}

export function saveGoalDismissals(map: GoalDismissals): void {
  try {
    localStorage.setItem(GOAL_DISMISSED_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn('Falha ao salvar desmarcações de meta do Pomo', error);
  }
}

// ---------- Pomodoro ----------

const POMO_SESSIONS_KEY = 'mono_habits_pomo_sessions_v1';
const POMO_SETTINGS_KEY = 'mono_habits_pomo_settings_v1';
const POMO_TIMER_KEY = 'mono_habits_pomo_timer_v1';

export function loadLocalPomoSessions(): PomoSession[] {
  try {
    const raw = localStorage.getItem(POMO_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Falha ao carregar sessões Pomo do localStorage:', error);
    return [];
  }
}

export function saveLocalPomoSessions(sessions: PomoSession[]): void {
  try {
    localStorage.setItem(POMO_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Falha ao salvar sessões Pomo no localStorage:', error);
  }
}

export interface PomoSettings {
  durations: PomoDurations;
  cycleCount: number;
  kind: PomoKind;
  lastHabitId?: string; // último hábito vinculado a um foco (ausente = sem vínculo)
}

export function loadPomoSettings(): PomoSettings {
  const fallback: PomoSettings = { durations: { ...DEFAULT_DURATIONS }, cycleCount: 0, kind: 'focus' };
  try {
    const raw = localStorage.getItem(POMO_SETTINGS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return {
      durations: {
        focus: clampMinutes(p?.durations?.focus ?? DEFAULT_DURATIONS.focus),
        short: clampMinutes(p?.durations?.short ?? DEFAULT_DURATIONS.short),
        long: clampMinutes(p?.durations?.long ?? DEFAULT_DURATIONS.long)
      },
      cycleCount: Number.isInteger(p?.cycleCount) ? p.cycleCount : 0,
      kind: ['focus', 'short', 'long'].includes(p?.kind) ? p.kind : 'focus',
      ...(typeof p?.lastHabitId === 'string' && p.lastHabitId ? { lastHabitId: p.lastHabitId } : {})
    };
  } catch {
    return fallback;
  }
}

export function savePomoSettings(settings: PomoSettings): void {
  try {
    localStorage.setItem(POMO_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Falha ao salvar configurações do Pomo', error);
  }
}

/** Timer em andamento: guardado por timestamps para sobreviver a recarga/segundo plano */
export interface PomoTimerState {
  kind: PomoKind;
  habitId?: string; // hábito vinculado a este foco
  plannedMs: number;
  startedAt: number;
  status: 'running' | 'paused';
  endsAt: number; // válido quando running
  remainingMs: number; // válido quando paused
}

export function loadPomoTimer(): PomoTimerState | null {
  try {
    const raw = localStorage.getItem(POMO_TIMER_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !['focus', 'short', 'long'].includes(p.kind)) return null;
    if (p.status !== 'running' && p.status !== 'paused') return null;
    return p as PomoTimerState;
  } catch {
    return null;
  }
}

export function savePomoTimer(timer: PomoTimerState | null): void {
  try {
    if (timer) localStorage.setItem(POMO_TIMER_KEY, JSON.stringify(timer));
    else localStorage.removeItem(POMO_TIMER_KEY);
  } catch (error) {
    console.warn('Falha ao salvar estado do timer Pomo', error);
  }
}

// ---------- Configurações do app ----------

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Falha ao salvar configurações', error);
  }
}

/** Data (YYYY-MM-DD) do último lembrete enviado, para não repetir no mesmo dia */
export function getLastReminderKey(): string | null {
  try {
    return localStorage.getItem(REMINDER_SENT_KEY);
  } catch {
    return null;
  }
}

export function setLastReminderKey(key: string): void {
  try {
    localStorage.setItem(REMINDER_SENT_KEY, key);
  } catch {
    /* sem armazenamento */
  }
}

/** Registro do lembrete nativo agendado para hoje (`{ dateKey, time }`), evitando disparo duplicado após o horário */
export function getScheduledTodayReminder(): { dateKey: string; time: string } | null {
  try {
    const raw = localStorage.getItem(REMINDER_SCHEDULED_TODAY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { dateKey?: unknown; time?: unknown };
    if (typeof p?.dateKey === 'string' && typeof p?.time === 'string') {
      return { dateKey: p.dateKey, time: p.time };
    }
    return null;
  } catch {
    return null;
  }
}

export function setScheduledTodayReminder(entry: { dateKey: string; time: string } | null): void {
  try {
    if (entry) {
      localStorage.setItem(REMINDER_SCHEDULED_TODAY_KEY, JSON.stringify(entry));
    } else {
      localStorage.removeItem(REMINDER_SCHEDULED_TODAY_KEY);
    }
  } catch {
    /* sem armazenamento */
  }
}

// ---------- Exportação e limpeza (gestão de conta) ----------

/** Dados do usuário (hábitos, check-ins, Pomo) para exportação em JSON */
export function exportLocalData() {
  return {
    app: 'MONO // HABITS',
    exportedAt: new Date().toISOString(),
    habits: loadLocalHabits(),
    logs: loadLocalLogs(),
    graces: loadLocalGraces(),
    slips: loadLocalSlips(),
    pomoSessions: loadLocalPomoSessions(),
    pomoSettings: loadPomoSettings(),
    settings: loadSettings()
  };
}

/** Apaga hábitos, check-ins, Pomo e lembretes do navegador. Mantém tema e configurações. */
/** Data (YYYY-MM-DD) da última transição de "dia completo", para tocar no máximo uma vez por dia */
export function getLastDayCompleteKey(): string | null {
  try {
    return localStorage.getItem(DAY_COMPLETE_KEY);
  } catch {
    return null;
  }
}

export function setLastDayCompleteKey(key: string): void {
  try {
    localStorage.setItem(DAY_COMPLETE_KEY, key);
  } catch {
    /* sem armazenamento */
  }
}

/** Marcos de ofensiva já avisados neste dispositivo; null = ainda não semeado (primeira execução) */
export function loadMilestonesSeen(): MilestonesSeen | null {
  try {
    const raw = localStorage.getItem(MILESTONES_SEEN_KEY);
    return raw ? sanitizeMilestonesSeen(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveMilestonesSeen(seen: MilestonesSeen): void {
  try {
    localStorage.setItem(MILESTONES_SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* sem armazenamento */
  }
}

/** Último uid sincronizado com a nuvem neste aparelho (evita misturar dados locais de outra conta) */
export function getLastSyncedUid(): string | null {
  try {
    const val = localStorage.getItem(LAST_SYNCED_UID_KEY);
    return val && val.trim() ? val : null;
  } catch {
    return null;
  }
}

export function setLastSyncedUid(uid: string | null): void {
  try {
    if (uid) localStorage.setItem(LAST_SYNCED_UID_KEY, uid);
    else localStorage.removeItem(LAST_SYNCED_UID_KEY);
  } catch {
    /* sem armazenamento */
  }
}

/**
 * Limpa apenas os dados sincronizáveis de uma conta anterior ao trocar de conta no mesmo aparelho
 * (mantém tema, configurações e bloqueio por PIN).
 */
export function clearLocalAccountData(): void {
  try {
    [
      HABITS_STORAGE_KEY,
      LOGS_STORAGE_KEY,
      GRACES_STORAGE_KEY,
      SLIPS_STORAGE_KEY,
      POMO_SESSIONS_KEY,
      REMINDER_SENT_KEY,
      REMINDER_SCHEDULED_TODAY_KEY,
      DAY_COMPLETE_KEY,
      MILESTONES_SEEN_KEY,
      GOAL_DISMISSED_KEY
    ].forEach((k) => localStorage.removeItem(k));
  } catch (error) {
    console.warn('Falha ao limpar dados da conta anterior', error);
  }
}

export interface SyncCollectionsCounts {
  habits: number;
  logs: number;
  graces: number;
  slips: number;
  pomoSessions: number;
}

/**
 * Regra M1 de migração local → nuvem:
 * - Se o aparelho guarda dados de OUTRO uid (`lastSyncedUid !== null && lastSyncedUid !== currentUid`),
 *   nunca migra e descarta o espelho local da conta anterior (`discardLocal = true`).
 * - Só migra (`migrate = true`) quando a conta na nuvem está totalmente vazia nas 5 coleções,
 *   há dados locais a enviar e os dados locais eram offline (`lastSyncedUid === null`) ou do próprio `currentUid`.
 */
export function evaluateInitialCloudSync(opts: {
  currentUid: string;
  lastSyncedUid: string | null;
  remoteCounts: SyncCollectionsCounts;
  localCounts: SyncCollectionsCounts;
}): { discardLocal: boolean; migrateLocalToCloud: boolean } {
  const { currentUid, lastSyncedUid, remoteCounts, localCounts } = opts;
  const isDifferentOwner = lastSyncedUid !== null && lastSyncedUid !== currentUid;
  if (isDifferentOwner) {
    return { discardLocal: true, migrateLocalToCloud: false };
  }
  const cloudEmpty =
    remoteCounts.habits === 0 &&
    remoteCounts.logs === 0 &&
    remoteCounts.graces === 0 &&
    remoteCounts.slips === 0 &&
    remoteCounts.pomoSessions === 0;
  const localHasData =
    localCounts.habits > 0 ||
    localCounts.logs > 0 ||
    localCounts.graces > 0 ||
    localCounts.slips > 0 ||
    localCounts.pomoSessions > 0;
  return {
    discardLocal: false,
    migrateLocalToCloud: cloudEmpty && localHasData
  };
}

export function clearLocalUserData(): void {
  try {
    [
      HABITS_STORAGE_KEY,
      LOGS_STORAGE_KEY,
      GRACES_STORAGE_KEY,
      SLIPS_STORAGE_KEY,
      LOCK_STORAGE_KEY, // "apagar dados deste dispositivo" também remove o bloqueio (saída para quem esqueceu o PIN)
      POMO_SESSIONS_KEY,
      POMO_SETTINGS_KEY,
      POMO_TIMER_KEY,
      REMINDER_SENT_KEY,
      REMINDER_SCHEDULED_TODAY_KEY,
      DAY_COMPLETE_KEY,
      MILESTONES_SEEN_KEY,
      GOAL_DISMISSED_KEY,
      LAST_SYNCED_UID_KEY
    ].forEach((k) => localStorage.removeItem(k));
  } catch (error) {
    console.warn('Falha ao limpar dados locais', error);
  }
}

// ---------- Boas-vindas / aceite da política ----------

/** Versão da política (data) aceita pelo usuário, ou null se ainda não aceitou */
export function getAcceptedPolicyVersion(): string | null {
  try {
    return localStorage.getItem(WELCOME_KEY);
  } catch {
    return null;
  }
}

export function setAcceptedPolicyVersion(version: string): void {
  try {
    localStorage.setItem(WELCOME_KEY, version);
  } catch {
    /* sem armazenamento: o aviso reaparece na próxima abertura */
  }
}
