import { type PomoSession, type PomoTask } from '@/types/habit';

export const MIN_TASK_POMOS = 1;
export const MAX_TASK_POMOS = 12;
export const DEFAULT_TASK_POMOS = 2;
export const MAX_TASK_TITLE_LENGTH = 200;
export const MAX_TASK_NOTES_LENGTH = 1000;

export interface TaskProgress {
  /** Quantidade de sessões de foco concluídas para esta tarefa */
  done: number;
  /** Meta de estimativa em pomos (1..12) */
  target: number;
  /** Razão de conclusão entre 0 e 1 */
  ratio: number;
  /** Se a estimativa planejada de pomos foi atingida ou superada */
  met: boolean;
}

const clampPomos = (n: number) =>
  Math.min(MAX_TASK_POMOS, Math.max(MIN_TASK_POMOS, Math.round(Number.isFinite(n) ? n : DEFAULT_TASK_POMOS)));

/**
 * Progresso de uma tarefa contando todas as sessões de foco concluídas vinculadas a ela (todas as datas).
 */
export function taskProgress(task: PomoTask, sessions: PomoSession[]): TaskProgress {
  const completedFocusCount = sessions.reduce((acc, s) => {
    if (s.kind === 'focus' && s.completed && s.taskId === task.id) {
      return acc + 1;
    }
    return acc;
  }, 0);

  const target = clampPomos(task.estimatedPomos);
  const ratio = target > 0 ? Math.min(1, completedFocusCount / target) : 0;
  const met = completedFocusCount >= target;

  return {
    done: completedFocusCount,
    target,
    ratio,
    met
  };
}

/**
 * Retorna as tarefas ativas disponíveis para vincular ao timer Pomo:
 * não concluídas, não deletadas, ordenadas por ordem manual crescente.
 */
export function getLinkableTasks(tasks: PomoTask[]): PomoTask[] {
  return tasks
    .filter((t) => !t.done && !t.deleted)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.createdAt - b.createdAt;
    });
}

/**
 * Valida e normaliza dados brutos de uma tarefa (vindos do storage local ou Firestore).
 * Retorna null se dados essenciais forem inválidos.
 */
export function normalizeTask(raw: unknown): PomoTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.id !== 'string' || !r.id.trim() || r.id.length > 100) return null;
  if (typeof r.title !== 'string' || !r.title.trim()) return null;

  const title = r.title.trim().slice(0, MAX_TASK_TITLE_LENGTH);
  const notes =
    typeof r.notes === 'string' && r.notes.trim()
      ? r.notes.trim().slice(0, MAX_TASK_NOTES_LENGTH)
      : undefined;

  const estimatedPomos = clampPomos(typeof r.estimatedPomos === 'number' ? r.estimatedPomos : DEFAULT_TASK_POMOS);
  const done = Boolean(r.done);
  const doneAt = typeof r.doneAt === 'number' && Number.isFinite(r.doneAt) && r.doneAt >= 0 ? r.doneAt : undefined;

  const now = Date.now();
  const createdAt = typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) && r.createdAt >= 0 ? r.createdAt : now;
  const updatedAt = typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) && r.updatedAt >= 0 ? r.updatedAt : createdAt;
  const order = typeof r.order === 'number' && Number.isFinite(r.order) ? r.order : 0;
  const deleted = Boolean(r.deleted);

  let google: PomoTask['google'] = undefined;
  if (r.google && typeof r.google === 'object') {
    const g = r.google as Record<string, unknown>;
    if (
      typeof g.listId === 'string' &&
      g.listId.trim() &&
      typeof g.taskId === 'string' &&
      g.taskId.trim() &&
      typeof g.updated === 'string' &&
      g.updated.trim()
    ) {
      google = {
        listId: g.listId.trim().slice(0, 100),
        taskId: g.taskId.trim().slice(0, 100),
        updated: g.updated.trim().slice(0, 50)
      };
    }
  }

  const task: PomoTask = {
    id: r.id.trim(),
    title,
    estimatedPomos,
    done,
    createdAt,
    updatedAt,
    order,
    ...(notes ? { notes } : {}),
    ...(doneAt !== undefined ? { doneAt } : {}),
    ...(deleted ? { deleted: true } : {}),
    ...(google ? { google } : {})
  };

  return task;
}

/**
 * Cria uma nova tarefa com defaults consistentes.
 */
export function createPomoTask(params: {
  title: string;
  estimatedPomos?: number;
  notes?: string;
  order?: number;
}): PomoTask {
  const now = Date.now();
  const id = `task-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const title = params.title.trim().slice(0, MAX_TASK_TITLE_LENGTH);
  const notes = params.notes?.trim() ? params.notes.trim().slice(0, MAX_TASK_NOTES_LENGTH) : undefined;
  const estimatedPomos = clampPomos(params.estimatedPomos ?? DEFAULT_TASK_POMOS);

  return {
    id,
    title,
    estimatedPomos,
    done: false,
    createdAt: now,
    updatedAt: now,
    order: params.order ?? 0,
    ...(notes ? { notes } : {})
  };
}
