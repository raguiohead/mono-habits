import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, Calendar, ChevronDown } from 'lucide-react';
import { WeeklyStrip } from './WeeklyStrip';
import { HabitItem } from './HabitItem';
import { useHabits } from '@/context/HabitsContext';
import { parseDateKey, formatFriendlyDate, toDateKey } from '@/lib/dateUtils';
import {
  PERIOD_LABEL,
  getCurrentPeriod,
  groupHabitsByPeriod,
  isSectionComplete
} from '@/lib/periods';
import { getHabitsForDate, calculateDailyProgress } from '@/lib/analytics';
import { isDueOn } from '@/lib/weekly';
import { featuredIds, orderFeaturedFirst } from '@/lib/bento';
import { useSettings } from '@/context/SettingsContext';
import { getEffectiveCompletedIds, isAvoid } from '@/lib/avoid';
import { type Habit, type HabitPeriod } from '@/types/habit';

interface DailyFocusProps {
  onOpenCreateModal: () => void;
  onOpenEditModal: (habit: Habit) => void;
}

export const DailyFocus: React.FC<DailyFocusProps> = ({
  onOpenCreateModal,
  onOpenEditModal
}) => {
  const {
    activeHabits,
    logs,
    slips,
    selectedDateKey,
    toggleHabitCompletion,
    seedStarterHabits
  } = useHabits();

  const selectedDate = useMemo(() => parseDateKey(selectedDateKey), [selectedDateKey]);

  // Hábitos do dia: os de dias fixos pelo dia da semana; os de meta semanal aparecem todos os dias
  const scheduledHabits = useMemo(
    () => getHabitsForDate(activeHabits, selectedDate),
    [activeHabits, selectedDate]
  );

  // Check-ins do dia. Hábitos a evitar nunca "concluem" (só registram escorregões), então ficam de fora:
  // assim suas seções não recolhem sozinhas e o botão "Escorreguei" continua à vista
  const completedIds = useMemo(() => {
    const avoidIds = new Set(activeHabits.filter(isAvoid).map((h) => h.id));
    return (logs[selectedDateKey] || []).filter((id) => !avoidIds.has(id));
  }, [logs, selectedDateKey, activeHabits]);

  // O progresso do dia só conta o que ainda é devido: um hábito semanal com a meta da semana
  // cumprida (e não feito hoje) não pesa contra o dia
  const dueHabits = useMemo(
    () => scheduledHabits.filter((h) => isDueOn(h, selectedDate, logs)),
    [scheduledHabits, selectedDate, logs]
  );

  // Progresso: hábitos a evitar contam como feitos por padrão e perdem 1 ao escorregar
  const doneIds = useMemo(
    () => getEffectiveCompletedIds(scheduledHabits, selectedDateKey, logs, slips, new Date()),
    [scheduledHabits, selectedDateKey, logs, slips]
  );

  const progressPercent = useMemo(
    () => calculateDailyProgress(dueHabits, doneIds),
    [dueHabits, doneIds]
  );

  const completedCount = useMemo(
    () => dueHabits.filter((h) => doneIds.includes(h.id)).length,
    [dueHabits, doneIds]
  );

  // Layout bento: grade de 2 colunas, com os hábitos em destaque ocupando a largura toda
  const { settings } = useSettings();
  const bento = settings.focusLayout === 'bento';
  const gallery = settings.focusLayout === 'gallery';
  const featured = useMemo(() => featuredIds(activeHabits), [activeHabits]);
  // Galeria: 1 coluna abaixo de 480px, 2 a partir daí (o contêiner de 672px não comporta 3 cartões legíveis)
  const itemsClass = bento
    ? 'grid grid-cols-2 gap-2.5 items-stretch'
    : gallery
    ? 'grid grid-cols-1 min-[480px]:grid-cols-2 gap-2.5 items-stretch'
    : 'space-y-2.5';
  const renderHabit = (habit: Habit) => {
    const item = (
      <HabitItem
        key={habit.id}
        habit={{ ...habit, featured: featured.has(habit.id) }}
        variant={bento ? 'bento' : gallery ? 'gallery' : 'list'}
        isCompleted={completedIds.includes(habit.id)}
        onToggle={() => toggleHabitCompletion(habit.id, selectedDateKey)}
        onEdit={() => onOpenEditModal(habit)}
      />
    );
    return bento || gallery ? (
      <div
        key={habit.id}
        className={featured.has(habit.id) ? (gallery ? 'min-[480px]:col-span-2' : 'col-span-2') : 'col-span-1 min-w-0'}
      >
        {item}
      </div>
    ) : (
      item
    );
  };

  // Agrupamento por período do dia (lista simples quando ninguém usa períodos)
  // Hábitos em destaque ficam fixados no topo da lista (ou da seção do período)
  const orderedHabits = useMemo(() => orderFeaturedFirst(scheduledHabits), [scheduledHabits]);
  const { grouped, sections } = useMemo(() => groupHabitsByPeriod(orderedHabits), [orderedHabits]);

  // Período atual, atualizado a cada minuto; só destacado ao ver o dia de hoje
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  const currentPeriod = selectedDateKey === toDateKey(now) ? getCurrentPeriod(now) : null;

  // Escolhas manuais de abrir/recolher (só em memória). Uma escolha vale enquanto o estado de
  // conclusão da seção não mudar; ao concluir (ou reabrir) a seção, volta ao comportamento automático.
  const [overrides, setOverrides] = useState<Partial<Record<HabitPeriod, { open: boolean; complete: boolean }>>>({});
  useEffect(() => setOverrides({}), [selectedDateKey]);

  return (
    <div className="space-y-6">
      {/* Fita Semanal */}
      <WeeklyStrip />

      {/* Cabeçalho da Data & Barra de Progresso */}
      <div className="p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3">
        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Progresso Diário
          </h2>
          <p className="text-sm font-semibold tracking-tight mt-0.5">
            {formatFriendlyDate(selectedDateKey)}
          </p>
        </div>

        {/* Número protagonista: largura reservada (5ch = "10/10") para não haver salto de layout */}
        <div className="flex items-baseline justify-between gap-3" aria-live="polite" aria-atomic="true">
          <span className="sr-only">
            {completedCount} de {dueHabits.length} hábitos concluídos, {progressPercent}% do dia
          </span>
          <span
            aria-hidden="true"
            className="inline-block min-w-[5ch] text-5xl font-bold font-mono tabular-nums tracking-tighter leading-none"
          >
            {completedCount}/{dueHabits.length}
          </span>
          <span
            aria-hidden="true"
            className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400"
          >
            <span className="inline-block min-w-[3ch] text-right">{progressPercent}%</span> do dia
          </span>
        </div>

        {/* Barra de Progresso Monocromática */}
        <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden border border-zinc-200/50 dark:border-zinc-800">
          <div
            className="h-full bg-zinc-950 dark:bg-zinc-50 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Lista de Hábitos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Hábitos do Dia ({scheduledHabits.length})
          </h3>
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Hábito</span>
          </button>
        </div>

        {/* Empty States */}
        {activeHabits.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-4 bg-zinc-50/50 dark:bg-zinc-900/20">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <Sparkles className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Nenhum hábito cadastrado</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                Comece do zero ou carregue hábitos minimalistas pré-configurados para testar o fluxo.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={seedStarterHabits}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                Carregar 4 Hábitos Exemplo
              </button>
              <button
                onClick={onOpenCreateModal}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Criar Meu Primeiro Hábito
              </button>
            </div>
          </div>
        ) : scheduledHabits.length === 0 ? (
          <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 text-center space-y-2 bg-white dark:bg-zinc-900/40">
            <Calendar className="w-8 h-8 mx-auto text-zinc-400 opacity-60" />
            <h4 className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Nenhum hábito programado para este dia
            </h4>
            <p className="text-[11px] text-zinc-500">
              Aproveite seu descanso ou ajuste a frequência semanal dos seus hábitos na aba "Hábitos & Rotinas".
            </p>
          </div>
        ) : (
          <div className={grouped ? 'space-y-4' : itemsClass}>
            {grouped
              ? sections.map((section) => {
                  const complete = isSectionComplete(section, completedIds);
                  const override = overrides[section.period];
                  const open = override && override.complete === complete ? override.open : !complete;
                  const done = section.habits.filter((h) => completedIds.includes(h.id)).length;
                  const isCurrent = section.period === currentPeriod;
                  const panelId = `period-${section.period}`;
                  return (
                    <section
                      key={section.period}
                      aria-label={PERIOD_LABEL[section.period]}
                      // A barra fica na margem da página, para os cartões manterem a largura total
                      className={`relative before:absolute before:-left-2.5 before:inset-y-1 before:w-0.5 before:rounded-full before:transition-colors ${
                        isCurrent ? 'before:bg-zinc-950 dark:before:bg-zinc-50' : 'before:bg-zinc-200 dark:before:bg-zinc-800'
                      }`}
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() =>
                          setOverrides((prev) => ({ ...prev, [section.period]: { open: !open, complete } }))
                        }
                        className={`w-full min-h-[44px] px-1 flex items-center justify-between gap-3 text-xs font-mono uppercase tracking-wider transition-opacity ${
                          isCurrent
                            ? 'text-zinc-950 dark:text-zinc-50 font-semibold'
                            : 'text-zinc-500 dark:text-zinc-400 opacity-80'
                        }`}
                      >
                        <span>{PERIOD_LABEL[section.period]}</span>
                        <span className="flex items-center gap-2 tabular-nums">
                          {done}/{section.habits.length}
                          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                      {open && (
                        <div id={panelId} className={`${itemsClass} pb-1`}>
                          {section.habits.map(renderHabit)}
                        </div>
                      )}
                    </section>
                  );
                })
              : orderedHabits.map(renderHabit)}
          </div>
        )}
      </div>
    </div>
  );
};
