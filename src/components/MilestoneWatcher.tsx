import { useEffect, useRef } from 'react';
import { useHabits } from '@/context/HabitsContext';
import { useDiscreet } from '@/context/SettingsContext';
import { diffMilestones, getHabitMilestones, milestoneUnit, seedSeen, type MilestonesSeen } from '@/lib/milestones';
import { loadMilestonesSeen, saveMilestonesSeen } from '@/lib/storage';

/**
 * Aviso sóbrio ao atingir um marco de ofensiva (7 · 30 · 100 · 365), uma vez por hábito+marco.
 * Na primeira execução semeia o histórico em silêncio. Em modo discreto o título é omitido.
 */
export const MilestoneWatcher: React.FC = () => {
  const { habits, logs, graces, slips, initialLoaded, showToast } = useHabits();
  const { active: discreet } = useDiscreet();
  const seenRef = useRef<MilestonesSeen | null>(null);

  useEffect(() => {
    if (!initialLoaded) return;
    const now = new Date();
    const items = habits.map((h) => ({ id: h.id, reached: getHabitMilestones(h, logs, now, graces, slips).reached }));
    if (seenRef.current === null) seenRef.current = loadMilestonesSeen();

    if (seenRef.current === null) {
      seenRef.current = seedSeen(items);
      saveMilestonesSeen(seenRef.current);
      return;
    }

    // Só avisa com o app à vista; sem avisar, o marco fica pendente para a próxima vez
    if (document.visibilityState !== 'visible') return;
    const active = items.filter((it) => habits.find((h) => h.id === it.id && !h.archived));
    const { announce, next } = diffMilestones(active, seenRef.current);
    if (announce.length === 0) return;
    seenRef.current = next;
    saveMilestonesSeen(next);

    const top = announce.reduce((a, b) => (b.milestone > a.milestone ? b : a));
    const habit = habits.find((h) => h.id === top.id);
    if (!habit) return;
    const label = `${top.milestone} ${milestoneUnit(habit, top.milestone, now)}`;
    // Pequeno atraso para não ser engolido pelo aviso da própria marcação
    window.setTimeout(() => showToast(habit.hideTitle || discreet ? label : `${label} · ${habit.title}`), 600);
  }, [habits, logs, graces, slips, initialLoaded, showToast, discreet]);

  return null;
};
