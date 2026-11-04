import { describe, it, expect } from 'vitest';
import { detectListConflict } from '../src/lib/tasksSync';
import { type PomoTask } from '../src/types/habit';

const task = (id: string, listId?: string, extra: Partial<PomoTask> = {}): PomoTask => ({
  id,
  title: id,
  estimatedPomos: 1,
  done: false,
  createdAt: 1,
  updatedAt: 1,
  order: 1,
  ...(listId ? { google: { listId, taskId: `g-${id}`, updated: '2026-11-03T00:00:00.000Z' } } : {}),
  ...extra
});

const work = { listId: 'L-work', listTitle: 'work' };
const tasks = { listId: 'L-tasks', listTitle: 'tasks' };

describe('detectListConflict (lista da conta x lista deste aparelho)', () => {
  it('sem lista local não há conflito: o aparelho só adota a da conta', () => {
    expect(detectListConflict(undefined, work, [task('a', 'L-tasks')])).toBeNull();
  });

  it('mesma lista: sem conflito', () => {
    expect(detectListConflict(work, work, [task('a', 'L-work')])).toBeNull();
  });

  it('lista diferente sem tarefas afetadas: troca silenciosa (nada a perder)', () => {
    expect(detectListConflict(tasks, work, [task('a'), task('b', 'L-work')])).toBeNull();
  });

  it('lista diferente com tarefas vinculadas à lista antiga: conflito com a contagem', () => {
    const conflict = detectListConflict(tasks, work, [task('a', 'L-tasks'), task('b', 'L-tasks'), task('c'), task('d', 'L-work')]);
    expect(conflict).toEqual({ remote: work, local: tasks, affectedCount: 2 });
  });

  it('tombstones da lista antiga não contam como tarefas afetadas', () => {
    expect(detectListConflict(tasks, work, [task('a', 'L-tasks', { deleted: true })])).toBeNull();
    const c = detectListConflict(tasks, work, [task('a', 'L-tasks', { deleted: true }), task('b', 'L-tasks')]);
    expect(c?.affectedCount).toBe(1);
  });

  it('tarefas locais nunca vinculadas ao Google não contam', () => {
    expect(detectListConflict(tasks, work, [task('a'), task('b')])).toBeNull();
  });
});
