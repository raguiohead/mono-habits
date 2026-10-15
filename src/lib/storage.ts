import { type Habit, type LogsMap } from '@/types/habit';

const HABITS_STORAGE_KEY = 'mono_habits_data_v1';
const LOGS_STORAGE_KEY = 'mono_habits_logs_v1';
const THEME_STORAGE_KEY = 'mono_habits_theme_v1';

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
