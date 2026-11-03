import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPomoTask,
  getLinkableTasks,
  normalizeTask,
  toFirestoreTask,
  taskProgress,
  MIN_TASK_POMOS,
  MAX_TASK_POMOS,
  DEFAULT_TASK_POMOS
} from '../src/lib/tasks';
import {
  loadLocalTasks,
  saveLocalTasks,
  clearLocalAccountData,
  clearLocalUserData,
  exportLocalData
} from '../src/lib/storage';
import { type PomoSession, type PomoTask } from '../src/types/habit';

const store = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  removeItem: (key: string) => {
    store.delete(key);
  },
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  }
};
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true, writable: true });

describe('Tarefas do Pomo (tasks.ts e storage)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('normalizeTask', () => {
    it('retorna null para valores nulos, indefinidos ou primitivos', () => {
      expect(normalizeTask(null)).toBeNull();
      expect(normalizeTask(undefined)).toBeNull();
      expect(normalizeTask('task-1')).toBeNull();
      expect(normalizeTask(123)).toBeNull();
    });

    it('retorna null para tarefa sem id ou com id inválido', () => {
      expect(normalizeTask({ title: 'Minha tarefa' })).toBeNull();
      expect(normalizeTask({ id: '', title: 'Minha tarefa' })).toBeNull();
      expect(normalizeTask({ id: '   ', title: 'Minha tarefa' })).toBeNull();
      expect(normalizeTask({ id: 'a'.repeat(101), title: 'Minha tarefa' })).toBeNull();
    });

    it('retorna null para tarefa sem título válido', () => {
      expect(normalizeTask({ id: 'task-1' })).toBeNull();
      expect(normalizeTask({ id: 'task-1', title: '' })).toBeNull();
      expect(normalizeTask({ id: 'task-1', title: '   ' })).toBeNull();
    });

    it('normaliza campos válidos e aplica limites de caracteres e pomos', () => {
      const longTitle = 'a'.repeat(250);
      const longNotes = 'b'.repeat(1500);

      const task = normalizeTask({
        id: 'task-1',
        title: longTitle,
        notes: longNotes,
        estimatedPomos: 99,
        done: true,
        doneAt: 1700000000000,
        createdAt: 1690000000000,
        updatedAt: 1695000000000,
        order: 5,
        deleted: false,
        google: {
          listId: 'list-1',
          taskId: 'gtask-1',
          updated: '2026-11-02T20:00:00.000Z'
        }
      });

      expect(task).not.toBeNull();
      expect(task?.id).toBe('task-1');
      expect(task?.title.length).toBe(200);
      expect(task?.notes?.length).toBe(1000);
      expect(task?.estimatedPomos).toBe(MAX_TASK_POMOS);
      expect(task?.done).toBe(true);
      expect(task?.doneAt).toBe(1700000000000);
      expect(task?.createdAt).toBe(1690000000000);
      expect(task?.updatedAt).toBe(1695000000000);
      expect(task?.order).toBe(5);
      expect(task?.deleted).toBeUndefined();
      expect(task?.google).toEqual({
        listId: 'list-1',
        taskId: 'gtask-1',
        updated: '2026-11-02T20:00:00.000Z'
      });
    });

    it('limita estimatedPomos para no mínimo 1', () => {
      const task = normalizeTask({
        id: 'task-1',
        title: 'Estudar',
        estimatedPomos: 0
      });
      expect(task?.estimatedPomos).toBe(MIN_TASK_POMOS);
    });

    it('ignora vínculo google se estiver incompleto', () => {
      const task = normalizeTask({
        id: 'task-1',
        title: 'Estudar',
        google: { listId: 'list-1' } // falta taskId e updated
      });
      expect(task?.google).toBeUndefined();
    });
  });

  describe('createPomoTask', () => {
    it('cria uma tarefa nova com defaults consistentes', () => {
      const task = createPomoTask({
        title: '  Escrever documentação  ',
        estimatedPomos: 3,
        order: 1
      });

      expect(task.id.startsWith('task-')).toBe(true);
      expect(task.title).toBe('Escrever documentação');
      expect(task.estimatedPomos).toBe(3);
      expect(task.done).toBe(false);
      expect(task.order).toBe(1);
      expect(task.createdAt).toBeGreaterThan(0);
      expect(task.updatedAt).toBe(task.createdAt);
    });

    it('usa estimativa padrão quando omitida', () => {
      const task = createPomoTask({ title: 'Ler artigo' });
      expect(task.estimatedPomos).toBe(DEFAULT_TASK_POMOS);
    });
  });

  describe('taskProgress', () => {
    const task: PomoTask = {
      id: 'task-abc',
      title: 'Refatorar módulo',
      estimatedPomos: 3,
      done: false,
      createdAt: 1000,
      updatedAt: 1000,
      order: 0
    };

    it('calcula progresso contando apenas sessões de foco concluídas vinculadas à tarefa', () => {
      const sessions: PomoSession[] = [
        {
          id: 's1',
          kind: 'focus',
          startedAt: 1000,
          endedAt: 2500,
          plannedSeconds: 1500,
          actualSeconds: 1500,
          completed: true,
          taskId: 'task-abc'
        },
        {
          id: 's2',
          kind: 'focus',
          startedAt: 3000,
          endedAt: 3500,
          plannedSeconds: 1500,
          actualSeconds: 500,
          completed: false, // interrompida: não conta
          taskId: 'task-abc'
        },
        {
          id: 's3',
          kind: 'short', // descanso: não conta
          startedAt: 4000,
          endedAt: 4300,
          plannedSeconds: 300,
          actualSeconds: 300,
          completed: true,
          taskId: 'task-abc'
        },
        {
          id: 's4',
          kind: 'focus',
          startedAt: 5000,
          endedAt: 6500,
          plannedSeconds: 1500,
          actualSeconds: 1500,
          completed: true,
          taskId: 'outra-tarefa' // outra tarefa: não conta
        },
        {
          id: 's5',
          kind: 'focus',
          startedAt: 7000,
          endedAt: 8500,
          plannedSeconds: 1500,
          actualSeconds: 1500,
          completed: true,
          taskId: 'task-abc'
        }
      ];

      const prog = taskProgress(task, sessions);
      expect(prog.done).toBe(2);
      expect(prog.target).toBe(3);
      expect(prog.ratio).toBeCloseTo(2 / 3);
      expect(prog.met).toBe(false);
    });

    it('marca met como true quando sessões concluídas atingem ou superam a estimativa', () => {
      const sessions: PomoSession[] = [
        {
          id: 's1',
          kind: 'focus',
          startedAt: 1000,
          endedAt: 2500,
          plannedSeconds: 1500,
          actualSeconds: 1500,
          completed: true,
          taskId: 'task-abc'
        },
        {
          id: 's2',
          kind: 'focus',
          startedAt: 3000,
          endedAt: 4500,
          plannedSeconds: 1500,
          actualSeconds: 1500,
          completed: true,
          taskId: 'task-abc'
        },
        {
          id: 's3',
          kind: 'focus',
          startedAt: 5000,
          endedAt: 6500,
          plannedSeconds: 1500,
          actualSeconds: 1500,
          completed: true,
          taskId: 'task-abc'
        },
        {
          id: 's4',
          kind: 'focus',
          startedAt: 7000,
          endedAt: 8500,
          plannedSeconds: 1500,
          actualSeconds: 1500,
          completed: true,
          taskId: 'task-abc'
        }
      ];

      const prog = taskProgress(task, sessions);
      expect(prog.done).toBe(4);
      expect(prog.target).toBe(3);
      expect(prog.ratio).toBe(1);
      expect(prog.met).toBe(true);
    });
  });

  describe('getLinkableTasks', () => {
    it('filtra tarefas concluídas ou deletadas e ordena por order e createdAt', () => {
      const tasks: PomoTask[] = [
        { id: 't1', title: 'Concluída', estimatedPomos: 1, done: true, createdAt: 100, updatedAt: 100, order: 0 },
        { id: 't2', title: 'Deletada', estimatedPomos: 2, done: false, deleted: true, createdAt: 200, updatedAt: 200, order: 1 },
        { id: 't3', title: 'Segunda', estimatedPomos: 2, done: false, createdAt: 300, updatedAt: 300, order: 2 },
        { id: 't4', title: 'Primeira', estimatedPomos: 1, done: false, createdAt: 400, updatedAt: 400, order: 1 },
        { id: 't5', title: 'Primeira emparelhada mais antiga', estimatedPomos: 1, done: false, createdAt: 150, updatedAt: 150, order: 1 }
      ];

      const linkable = getLinkableTasks(tasks);
      expect(linkable.map((t) => t.id)).toEqual(['t5', 't4', 't3']);
    });
  });

  describe('Storage de tarefas', () => {
    it('carrega lista vazia por padrão', () => {
      expect(loadLocalTasks()).toEqual([]);
    });

    it('salva e recupera tarefas do localStorage sanitizando os dados', () => {
      const task = createPomoTask({ title: 'Teste storage', estimatedPomos: 4 });
      saveLocalTasks([task]);

      const loaded = loadLocalTasks();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe(task.id);
      expect(loaded[0].title).toBe('Teste storage');
      expect(loaded[0].estimatedPomos).toBe(4);
    });

    it('exportLocalData inclui a coleção de tarefas', () => {
      const task = createPomoTask({ title: 'Exportar me' });
      saveLocalTasks([task]);

      const data = exportLocalData();
      expect(data.tasks).toBeDefined();
      expect(data.tasks).toHaveLength(1);
      expect(data.tasks[0].id).toBe(task.id);
    });

    it('clearLocalAccountData e clearLocalUserData apagam tarefas locais', () => {
      saveLocalTasks([createPomoTask({ title: 'T1' })]);
      expect(loadLocalTasks()).toHaveLength(1);

      clearLocalAccountData();
      expect(loadLocalTasks()).toHaveLength(0);

      saveLocalTasks([createPomoTask({ title: 'T2' })]);
      expect(loadLocalTasks()).toHaveLength(1);

      clearLocalUserData();
      expect(loadLocalTasks()).toHaveLength(0);
    });
  });

  describe('toFirestoreTask', () => {
    it('remove estritamente todas as chaves com valor undefined', () => {
      const taskWithUndefined: any = {
        id: 'task-1',
        title: 'Tarefa sem notas',
        estimatedPomos: 2,
        done: false,
        createdAt: 1000,
        updatedAt: 1000,
        order: 0,
        notes: undefined,
        doneAt: undefined,
        deleted: undefined,
        google: undefined
      };

      const firestoreDoc = toFirestoreTask(taskWithUndefined);

      expect('notes' in firestoreDoc).toBe(false);
      expect('doneAt' in firestoreDoc).toBe(false);
      expect('deleted' in firestoreDoc).toBe(false);
      expect('google' in firestoreDoc).toBe(false);

      expect(Object.values(firestoreDoc)).not.toContain(undefined);
      expect(firestoreDoc).toEqual({
        id: 'task-1',
        title: 'Tarefa sem notas',
        estimatedPomos: 2,
        done: false,
        createdAt: 1000,
        updatedAt: 1000,
        order: 0
      });
    });

    it('remove chaves undefined dentro de objetos aninhados como google', () => {
      const taskWithNested: any = {
        id: 'task-2',
        title: 'Tarefa com Google',
        estimatedPomos: 1,
        done: true,
        doneAt: 2000,
        createdAt: 1000,
        updatedAt: 2000,
        order: 1,
        google: {
          listId: 'list-1',
          taskId: 'gtask-1',
          updated: '2026-11-02T10:00:00.000Z',
          extraField: undefined
        }
      };

      const firestoreDoc = toFirestoreTask(taskWithNested);

      expect('extraField' in (firestoreDoc.google as any)).toBe(false);
      expect(firestoreDoc.google).toEqual({
        listId: 'list-1',
        taskId: 'gtask-1',
        updated: '2026-11-02T10:00:00.000Z'
      });
      expect(Object.values(firestoreDoc.google as any)).not.toContain(undefined);
    });

    it('preserva valores falsy válidos (false, 0, strings preenchidas)', () => {
      const task: PomoTask = {
        id: 'task-3',
        title: 'Zero Pomos',
        estimatedPomos: 1,
        done: false,
        order: 0,
        createdAt: 0,
        updatedAt: 0,
        notes: 'Nota existente'
      };

      const doc = toFirestoreTask(task);
      expect(doc.done).toBe(false);
      expect(doc.order).toBe(0);
      expect(doc.createdAt).toBe(0);
      expect(doc.updatedAt).toBe(0);
      expect(doc.notes).toBe('Nota existente');
      expect(Object.values(doc)).not.toContain(undefined);
    });
  });
});
