import type { GracesMap, Habit, LogsMap, SlipsMap } from '@/types/habit';
import { calculateBestStreak } from './analytics';
import { isWeeklyOn } from './weekly';

export const MILESTONES = [7, 30, 100, 365] as const;

/** Marcos já atingidos (em ordem) para uma melhor ofensiva */
export function reachedMilestones(best: number): number[] {
  return MILESTONES.filter((m) => best >= m);
}

/** Maior marco atingido, ou null */
export function highestMilestone(best: number): number | null {
  const r = reachedMilestones(best);
  return r.length ? r[r.length - 1] : null;
}

/** Próximo marco ainda não atingido, ou null quando todos foram atingidos */
export function nextMilestone(best: number): number | null {
  return MILESTONES.find((m) => best < m) ?? null;
}

export interface HabitMilestones {
  best: number;
  reached: number[];
  highest: number | null;
  next: number | null;
}

/**
 * Marcos de um hábito pela melhor ofensiva histórica. A unidade segue a ofensiva do hábito:
 * semanas para hábitos com meta semanal, dias nos demais (inclusive os a evitar, em dias limpos).
 */
export function getHabitMilestones(
  habit: Habit,
  logs: LogsMap,
  today: Date = new Date(),
  graces: GracesMap = {},
  slips: SlipsMap = {}
): HabitMilestones {
  const best = calculateBestStreak(habit, logs, today, graces, slips);
  return { best, reached: reachedMilestones(best), highest: highestMilestone(best), next: nextMilestone(best) };
}

export function milestoneUnit(habit: Habit, n: number, today: Date = new Date()): string {
  if (isWeeklyOn(habit, today)) return n === 1 ? 'semana' : 'semanas';
  return n === 1 ? 'dia' : 'dias';
}

/** Marcos já avisados, por hábito: { habitId: [7, 30] } */
export type MilestonesSeen = Record<string, number[]>;

export function sanitizeMilestonesSeen(raw: unknown): MilestonesSeen | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: MilestonesSeen = {};
  for (const [id, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    out[id] = list.filter((n): n is number => typeof n === 'number' && (MILESTONES as readonly number[]).includes(n));
  }
  return out;
}

export interface MilestoneInput {
  id: string;
  reached: number[];
}

/** Semeia o que já foi atingido, sem avisar (primeira execução) */
export function seedSeen(items: MilestoneInput[]): MilestonesSeen {
  const out: MilestonesSeen = {};
  for (const it of items) out[it.id] = [...it.reached];
  return out;
}

/**
 * Marcos novos (atingidos e ainda não avisados) e o `seen` atualizado.
 * Vários marcos de uma vez viram um único aviso, com o maior deles.
 */
export function diffMilestones(
  items: MilestoneInput[],
  seen: MilestonesSeen
): { announce: { id: string; milestone: number }[]; next: MilestonesSeen } {
  const next: MilestonesSeen = { ...seen };
  const announce: { id: string; milestone: number }[] = [];
  for (const it of items) {
    const known = new Set(seen[it.id] || []);
    const fresh = it.reached.filter((m) => !known.has(m));
    if (fresh.length === 0) continue;
    next[it.id] = [...known, ...fresh].sort((a, b) => a - b);
    announce.push({ id: it.id, milestone: Math.max(...fresh) });
  }
  return { announce, next };
}
