import { type Habit, type LogsMap, type PomoSession, type PomoKind } from '@/types/habit';
import { DEFAULT_DURATIONS, clampMinutes, type PomoDurations } from './pomo';
import { DEFAULT_SETTINGS, sanitizeSettings, type AppSettings } from './settings';
import { pruneDismissals, type GoalDismissals } from './pomoGoals';

const HABITS_STORAGE_KEY = 'mono_habits_data_v1';
const LOGS_STORAGE_KEY = 'mono_habits_logs_v1';
const THEME_STORAGE_KEY = 'mono_habits_theme_v1';
const SETTINGS_STORAGE_KEY = 'mono_habits_settings_v1';
const WELCOME_KEY = 'mono_habits_welcome_v1';
const REMINDER_SENT_KEY = 'mono_habits_reminder_sent_v1';
const GOAL_DISMISSED_KEY = 'mono_habits_goal_dismissed_v1';

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
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Falha ao carregar hábitos do localStorage:', error);
    return [];
  }
}

export function saveLocalHabits(habits: Habit[]): void {
  try {
    localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
  } catch (error) {
    console.error('Falha ao salvar hábitos no localStorage:', error);
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

// ---------- Exportação e limpeza (gestão de conta) ----------

/** Dados do usuário (hábitos, check-ins, Pomo) para exportação em JSON */
export function exportLocalData() {
  return {
    app: 'MONO // HABITS',
    exportedAt: new Date().toISOString(),
    habits: loadLocalHabits(),
    logs: loadLocalLogs(),
    pomoSessions: loadLocalPomoSessions(),
    pomoSettings: loadPomoSettings(),
    settings: loadSettings()
  };
}

/** Apaga hábitos, check-ins, Pomo e lembretes do navegador. Mantém tema e configurações. */
export function clearLocalUserData(): void {
  try {
    [
      HABITS_STORAGE_KEY,
      LOGS_STORAGE_KEY,
      POMO_SESSIONS_KEY,
      POMO_SETTINGS_KEY,
      POMO_TIMER_KEY,
      REMINDER_SENT_KEY,
      GOAL_DISMISSED_KEY
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
