import { describe, it, expect } from 'vitest';
import { mergeTasks } from '../src/lib/tasksSync';
import { type PomoTask } from '../src/types/habit';
import { type GoogleTaskItem } from '../src/lib/googleTasksApi';

describe('Motor de sincronização bidirecional do Google Tasks (tasksSync.ts)', () => {
  const LIST_ID = 'test-list-123';

  it('cria tarefa no Google quando criada apenas localmente', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-local-1',
        title: 'Estudar TypeScript',
        notes: 'Capítulo sobre tipos utilitários',
        estimatedPomos: 3,
        done: false,
        createdAt: 1000,
        updatedAt: 1000,
        order: 0
      }
    ];
    const remoteItems: GoogleTaskItem[] = [];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toPushCreateRemote).toHaveLength(1);
    expect(plan.toPushCreateRemote[0].localTaskId).toBe('task-local-1');
    expect(plan.toPushCreateRemote[0].payload.title).toBe('Estudar TypeScript');
    expect(plan.toPushCreateRemote[0].payload.status).toBe('needsAction');
    expect(plan.toUpsertLocal).toHaveLength(0);
  });

  it('cria tarefa local quando criada no Google, com estimatedPomos = 1', () => {
    const localTasks: PomoTask[] = [];
    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-remote-1',
        title: 'Comprar café',
        notes: 'Grãos torra média',
        status: 'needsAction',
        updated: '2026-11-02T12:00:00.000Z'
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toUpsertLocal).toHaveLength(1);
    const createdLocal = plan.toUpsertLocal[0];
    expect(createdLocal.title).toBe('Comprar café');
    expect(createdLocal.notes).toBe('Grãos torra média');
    expect(createdLocal.estimatedPomos).toBe(1);
    expect(createdLocal.done).toBe(false);
    expect(createdLocal.google).toEqual({
      listId: LIST_ID,
      taskId: 'gtask-remote-1',
      updated: '2026-11-02T12:00:00.000Z'
    });
  });

  it('conflito LWW: atualiza local quando o Google é mais recente, mantendo estimatedPomos e createdAt', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Título antigo',
        notes: 'Nota antiga',
        estimatedPomos: 4,
        done: false,
        createdAt: 1000,
        updatedAt: 2000,
        order: 2,
        google: {
          listId: LIST_ID,
          taskId: 'gtask-1',
          updated: '2026-11-02T10:00:00.000Z'
        }
      }
    ];

    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-1',
        title: 'Título atualizado no Google',
        notes: 'Nota atualizada',
        status: 'completed',
        completed: '2026-11-02T12:30:00.000Z',
        updated: '2026-11-02T12:30:00.000Z' // Mais recente que 2000 ms
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toUpsertLocal).toHaveLength(1);
    const updated = plan.toUpsertLocal[0];
    expect(updated.title).toBe('Título atualizado no Google');
    expect(updated.notes).toBe('Nota atualizada');
    expect(updated.done).toBe(true);
    // Preserva estimatedPomos, order e createdAt locais!
    expect(updated.estimatedPomos).toBe(4);
    expect(updated.createdAt).toBe(1000);
    expect(updated.order).toBe(2);
    expect(plan.toPushUpdateRemote).toHaveLength(0);
  });

  it('conflito LWW: atualiza remoto quando o local é mais recente', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Título editado no app',
        estimatedPomos: 2,
        done: true,
        doneAt: new Date('2026-11-02T15:00:00.000Z').getTime(),
        createdAt: 1000,
        updatedAt: new Date('2026-11-02T15:00:00.000Z').getTime(), // Mais recente que 2026-11-01
        order: 0,
        google: {
          listId: LIST_ID,
          taskId: 'gtask-1',
          updated: '2026-11-01T00:00:00.000Z'
        }
      }
    ];

    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-1',
        title: 'Título desatualizado',
        status: 'needsAction',
        updated: '2026-11-01T00:00:00.000Z'
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toPushUpdateRemote).toHaveLength(1);
    expect(plan.toPushUpdateRemote[0].googleTaskId).toBe('gtask-1');
    expect(plan.toPushUpdateRemote[0].payload.title).toBe('Título editado no app');
    expect(plan.toPushUpdateRemote[0].payload.status).toBe('completed');
    expect(plan.toUpsertLocal).toHaveLength(0);
  });

  it('exclusão local propaga para o Google', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Deletada no app',
        estimatedPomos: 1,
        done: false,
        deleted: true,
        createdAt: 1000,
        updatedAt: 3000,
        order: 0,
        google: {
          listId: LIST_ID,
          taskId: 'gtask-1',
          updated: '2026-11-02T10:00:00.000Z'
        }
      }
    ];

    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-1',
        title: 'Deletada no app',
        status: 'needsAction',
        updated: '2026-11-02T10:00:00.000Z'
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toDeleteRemote).toEqual(['gtask-1']);
  });

  it('exclusão no Google gera tombstone local', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Ativa no app mas deletada no Google',
        estimatedPomos: 1,
        done: false,
        createdAt: 1000,
        updatedAt: 1000,
        order: 0,
        google: {
          listId: LIST_ID,
          taskId: 'gtask-1',
          updated: '2026-11-02T10:00:00.000Z'
        }
      }
    ];

    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-1',
        title: 'Ativa no app mas deletada no Google',
        status: 'needsAction',
        deleted: true,
        updated: '2026-11-02T11:00:00.000Z'
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toTombstoneLocal).toEqual(['task-1']);
  });
});
