import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Minus, Plus } from 'lucide-react';
import { HABIT_ICONS } from './HabitIcon';
import { ModalShell } from './ModalShell';
import { DAYS_SHORT } from '@/lib/dateUtils';
import { type Habit, type HabitKind, type HabitPeriod } from '@/types/habit';
import { normalizeKind } from '@/lib/avoid';
import {
  MAX_WEEKLY_TARGET,
  MIN_WEEKLY_TARGET,
  applyWeeklyTargetChange,
  hasWeeklyTarget,
  normalizeWeeklyTarget,
  targetForWeek,
  weekStartKey
} from '@/lib/weekly';
import { formatFriendlyDate } from '@/lib/dateUtils';
import {
  DEFAULT_GOAL_MINUTES,
  DEFAULT_GOAL_SESSIONS,
  GOAL_LIMITS,
  normalizePomoGoal
} from '@/lib/pomoGoals';
import { useHabits } from '@/context/HabitsContext';
import { MAX_FEATURED, canFeature } from '@/lib/bento';
import { HABIT_DESCRIPTION_MAX, sanitizeHabitDescription } from '@/lib/habitDescription';
import { PERIOD_LABEL, normalizePeriod } from '@/lib/periods';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habitData: Omit<Habit, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => void;
  initialHabit?: Habit | null;
}

const PERIOD_OPTIONS: HabitPeriod[] = ['any', 'morning', 'afternoon', 'evening'];

const COMMON_CATEGORIES = ['Saúde', 'Intelecto', 'Trabalho', 'Rotina', 'Mente', 'Finanças', 'Geral'];

export const HabitModal: React.FC<HabitModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialHabit
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('target');
  const [hideTitle, setHideTitle] = useState(false);
  const [period, setPeriod] = useState<HabitPeriod>('any');
  const [featured, setFeatured] = useState(false);
  const { habits } = useHabits();
  // Destaque do layout bento: limite de MAX_FEATURED (editar um já destacado não conta contra si)
  const featuredAllowed = canFeature(habits, initialHabit?.id) || Boolean(initialHabit?.featured);
  // Construir (marcar quando fizer) ou evitar (registrar só quando escorregar)
  const [kind, setKind] = useState<HabitKind>('build');
  // Meta com Pomo (desligada por padrão); guarda o alvo de cada tipo separadamente
  const [goalEnabled, setGoalEnabled] = useState(false);
  const [goalType, setGoalType] = useState<'minutes' | 'sessions'>('minutes');
  const [goalMinutes, setGoalMinutes] = useState(DEFAULT_GOAL_MINUTES);
  const [goalSessions, setGoalSessions] = useState(DEFAULT_GOAL_SESSIONS);
  const [frequency, setFrequency] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  // Dias fixos ou meta semanal (o hábito semanal aparece todos os dias)
  const [scheduleMode, setScheduleMode] = useState<'days' | 'weekly'>('days');
  const [weeklyTarget, setWeeklyTarget] = useState(3);

  useEffect(() => {
    if (initialHabit) {
      setTitle(initialHabit.title);
      setCategory(initialHabit.category || '');
      setDescription(initialHabit.description || '');
      setIcon(initialHabit.icon || 'target');
      setHideTitle(Boolean(initialHabit.hideTitle));
      setPeriod(normalizePeriod(initialHabit.period));
      setFeatured(Boolean(initialHabit.featured));
      setKind(normalizeKind(initialHabit.kind));
      const goal = normalizePomoGoal(initialHabit.pomoGoal);
      setGoalEnabled(Boolean(goal));
      setGoalType(goal?.type ?? 'minutes');
      setGoalMinutes(goal?.type === 'minutes' ? goal.target : DEFAULT_GOAL_MINUTES);
      setGoalSessions(goal?.type === 'sessions' ? goal.target : DEFAULT_GOAL_SESSIONS);
      setFrequency(initialHabit.frequency || [0, 1, 2, 3, 4, 5, 6]);
      setScheduleMode(hasWeeklyTarget(initialHabit) ? 'weekly' : 'days');
      setWeeklyTarget(normalizeWeeklyTarget(initialHabit.weeklyTarget) ?? 3);
    } else {
      setTitle('');
      setCategory('Saúde');
      setDescription('');
      setIcon('target');
      setHideTitle(false);
      setFeatured(false);
      setPeriod('any');
      setKind('build');
      setGoalEnabled(false);
      setGoalType('minutes');
      setGoalMinutes(DEFAULT_GOAL_MINUTES);
      setGoalSessions(DEFAULT_GOAL_SESSIONS);
      setFrequency([0, 1, 2, 3, 4, 5, 6]);
      setScheduleMode('days');
      setWeeklyTarget(3);
    }
  }, [initialHabit, isOpen]);

  // Mudar a meta de um hábito semanal vale só a partir da próxima semana
  const pendingNote = (() => {
    if (!initialHabit || scheduleMode !== 'weekly' || !hasWeeklyTarget(initialHabit)) return null;
    const today = new Date();
    const current = targetForWeek(initialHabit, weekStartKey(today));
    if (current === null) return null;
    const next = applyWeeklyTargetChange(initialHabit, weeklyTarget, today);
    if (next.weeklyTarget === undefined || next.weeklyTarget === current) return null;
    return `Esta semana continua ${current}x; a nova meta (${weeklyTarget}x) vale a partir de ${formatFriendlyDate(next.weeklyTargetFrom ?? '')}.`;
  })();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if ((scheduleMode === 'days' || kind === 'avoid') && frequency.length === 0) return;

    onSave({
      id: initialHabit ? initialHabit.id : undefined,
      title: title.trim(),
      category: category.trim() || 'Geral',
      description: sanitizeHabitDescription(description),
      icon: icon || 'target',
      hideTitle,
      featured: featured && featuredAllowed,
      period,
      // Hábito a evitar não tem meta do Pomo nem meta semanal
      kind,
      pomoGoal: goalEnabled && kind === 'build'
        ? normalizePomoGoal({ type: goalType, target: goalType === 'minutes' ? goalMinutes : goalSessions })
        : undefined,
      frequency: [...frequency].sort(),
      weeklyTarget: scheduleMode === 'weekly' && kind === 'build' ? weeklyTarget : undefined,
      archived: initialHabit ? initialHabit.archived : false,
      createdAt: initialHabit ? initialHabit.createdAt : Date.now()
    });

    onClose();
  };

  const toggleDay = (dayIndex: number) => {
    setFrequency((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  return (
    <ModalShell labelledBy="habit-modal-title" onClose={onClose} widthClass="sm:max-w-lg">
      <div className="space-y-5">
        {/* Topo do Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-zinc-800">
          <div>
            <h3 id="habit-modal-title" className="text-base font-semibold tracking-tight">
              {initialHabit ? 'Editar Hábito' : 'Novo Hábito'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Configure sua rotina com estética minimalista
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl opacity-60 hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Tipo: construir ou evitar */}
          <div>
            <span id="habit-kind-label" className="block mb-1.5 font-medium text-zinc-700 dark:text-zinc-300">
              Tipo de hábito
            </span>
            <div role="radiogroup" aria-labelledby="habit-kind-label" className="grid grid-cols-2 gap-1.5">
              {([
                { value: 'build', label: 'Construir hábito' },
                { value: 'avoid', label: 'Evitar hábito' }
              ] as const).map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  role="radio"
                  aria-checked={kind === opt.value}
                  onClick={() => setKind(opt.value)}
                  className={`min-h-[44px] rounded-xl text-xs font-mono border transition-all ${
                    kind === opt.value
                      ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50 font-semibold'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {kind === 'avoid'
                ? 'Você só registra quando escorregar. Os dias sem registro contam como limpos, e um escorregão não apaga o que você já conquistou.'
                : 'Você marca o hábito nos dias em que o fizer.'}
            </p>
          </div>

          {/* Nome */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
              Nome do Hábito *
            </label>
            <input
              type="text"
              required
              maxLength={80}
              placeholder="Ex: Meditação matinal (15 min)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-50 text-xs"
            />
          </div>

          {/* Categoria */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
              Categoria
            </label>
            <input
              type="text"
              placeholder="Ex: Saúde, Foco, Trabalho..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-50 text-xs mb-2"
            />
            {/* Sugestões de Categoria */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
                    category === cat
                      ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Descrição (opcional) */}
          <div>
            <label htmlFor="habit-description" className="block font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
              Descrição (opcional)
            </label>
            <textarea
              id="habit-description"
              rows={2}
              maxLength={HABIT_DESCRIPTION_MAX}
              placeholder="Ex: 10 páginas antes de dormir"
              aria-describedby="habit-description-count"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-50 text-xs resize-none"
            />
            <p
              id="habit-description-count"
              aria-live="polite"
              className="mt-1 text-right text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400"
            >
              {description.length}/{HABIT_DESCRIPTION_MAX}
            </p>
          </div>

          {/* Seletor de Ícones (16 ícones minimalistas) */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
              Ícone Representativo
            </label>
            <div className="grid grid-cols-8 gap-1.5">
              {HABIT_ICONS.map((item) => {
                const IconComponent = item.Icon;
                const isSelected = icon === item.key;
                return (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => setIcon(item.key)}
                    className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50 scale-105'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                    }`}
                    title={item.label}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modo Discreto (Ocultar Nome do Hábito) */}
          <div
            onClick={() => setHideTitle(!hideTitle)}
            className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-colors ${
              hideTitle
                ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-400 dark:border-zinc-700'
                : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {hideTitle ? (
                <EyeOff className="w-4 h-4 shrink-0 text-zinc-900 dark:text-zinc-100" />
              ) : (
                <Eye className="w-4 h-4 shrink-0 opacity-60" />
              )}
              <div>
                <p className="font-medium text-xs">Modo Discreto (Ocultar Nome)</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Exibe apenas o ícone e a tag na fita diária para privacidade visual
                </p>
              </div>
            </div>
            <div
              className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
                hideTitle ? 'bg-zinc-950 dark:bg-zinc-50' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full transition-transform ${
                  hideTitle
                    ? 'translate-x-4 bg-white dark:bg-zinc-950'
                    : 'translate-x-0 bg-white'
                }`}
              />
            </div>
          </div>

          {/* Destaque no layout bento */}
          <div className="space-y-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={featured && featuredAllowed}
              disabled={!featuredAllowed && !featured}
              onClick={() => setFeatured(!featured)}
              className="w-full min-h-[44px] flex items-center justify-between gap-3 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-left disabled:opacity-50"
            >
              <span>
                <span className="block font-medium text-xs">Destacar (fixar no topo)</span>
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Fica no topo do Foco com marca de fixado; no layout Bento ocupa a largura toda (até {MAX_FEATURED} hábitos)
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
                  featured && featuredAllowed ? 'bg-zinc-950 dark:bg-zinc-50' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform ${
                    featured && featuredAllowed ? 'translate-x-4 bg-white dark:bg-zinc-950' : 'translate-x-0 bg-white'
                  }`}
                />
              </span>
            </button>
            {!featuredAllowed && !initialHabit?.featured && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Limite de {MAX_FEATURED} hábitos em destaque atingido. Remova um destaque para escolher outro.
              </p>
            )}
          </div>

          {/* Frequência: dias fixos ou meta semanal */}
          <div className="space-y-2">
            <span id="habit-schedule-label" className="block font-medium text-zinc-700 dark:text-zinc-300">
              {kind === 'avoid' ? 'Dias em que quero evitar' : 'Frequência'}
            </span>
            <div
              role="radiogroup"
              aria-labelledby="habit-schedule-label"
              className={`grid grid-cols-2 gap-1.5 ${kind === 'avoid' ? 'hidden' : ''}`}
            >
              {([
                { value: 'days', label: 'Dias fixos' },
                { value: 'weekly', label: 'X vezes por semana' }
              ] as const).map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  role="radio"
                  aria-checked={scheduleMode === opt.value}
                  onClick={() => setScheduleMode(opt.value)}
                  className={`min-h-[44px] rounded-xl text-xs font-mono border transition-all ${
                    scheduleMode === opt.value
                      ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50 font-semibold'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {scheduleMode === 'days' || kind === 'avoid' ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">Dias da semana</label>
                  <button
                    type="button"
                    onClick={() => setFrequency([0, 1, 2, 3, 4, 5, 6])}
                    className="text-[11px] font-mono underline opacity-75 hover:opacity-100"
                  >
                    Marcar todos
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_SHORT.map((dayLabel, idx) => {
                    const selected = frequency.includes(idx);
                    return (
                      <button
                        type="button"
                        key={dayLabel}
                        onClick={() => toggleDay(idx)}
                        className={`py-2 rounded-xl text-xs font-mono border transition-all ${
                          selected
                            ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50 font-semibold'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {dayLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setWeeklyTarget((v) => Math.max(MIN_WEEKLY_TARGET, v - 1))}
                    disabled={weeklyTarget <= MIN_WEEKLY_TARGET}
                    aria-label="Diminuir meta semanal"
                    className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="min-w-[10ch] text-center font-mono" aria-live="polite">
                    <span className="text-2xl font-bold tabular-nums">{weeklyTarget}</span>{' '}
                    <span className="text-xs text-zinc-500">{weeklyTarget === 1 ? 'vez/semana' : 'vezes/semana'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWeeklyTarget((v) => Math.min(MAX_WEEKLY_TARGET, v + 1))}
                    disabled={weeklyTarget >= MAX_WEEKLY_TARGET}
                    aria-label="Aumentar meta semanal"
                    className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed text-center">
                  O hábito aparece todos os dias e vale na semana (segunda a domingo) ao atingir a meta.
                </p>
                {pendingNote && (
                  <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed text-center font-medium">
                    {pendingNote}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Período do Dia */}
          <div>
            <span id="habit-period-label" className="block mb-1.5 font-medium text-zinc-700 dark:text-zinc-300">
              Período do Dia
            </span>
            <div role="radiogroup" aria-labelledby="habit-period-label" className="grid grid-cols-4 gap-1.5">
              {PERIOD_OPTIONS.map((opt) => {
                const selected = period === opt;
                return (
                  <button
                    type="button"
                    key={opt}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPeriod(opt)}
                    className={`min-h-[44px] px-1 rounded-xl text-[11px] leading-tight font-mono border transition-all ${
                      selected
                        ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50 font-semibold'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {PERIOD_LABEL[opt]}
                  </button>
                );
              })}
            </div>
          </div>

          {kind === 'build' && (
            <>
          {/* Meta com Pomo */}
          <div
            className={`p-3 rounded-2xl border space-y-3 transition-colors ${
              goalEnabled
                ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-400 dark:border-zinc-700'
                : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <button
              type="button"
              role="switch"
              aria-checked={goalEnabled}
              onClick={() => setGoalEnabled(!goalEnabled)}
              className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left"
            >
              <span>
                <span className="block font-medium text-xs">Meta com Pomo</span>
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  O hábito é concluído sozinho ao atingir a meta do dia com sessões de foco vinculadas
                </span>
              </span>
              <span
                className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
                  goalEnabled ? 'bg-zinc-950 dark:bg-zinc-50' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform ${
                    goalEnabled ? 'translate-x-4 bg-white dark:bg-zinc-950' : 'translate-x-0 bg-white'
                  }`}
                />
              </span>
            </button>

            {goalEnabled && (
              <>
                <div role="radiogroup" aria-label="Tipo de meta" className="grid grid-cols-2 gap-1.5">
                  {(['minutes', 'sessions'] as const).map((type) => (
                    <button
                      type="button"
                      key={type}
                      role="radio"
                      aria-checked={goalType === type}
                      onClick={() => setGoalType(type)}
                      className={`min-h-[44px] rounded-xl text-xs font-mono border transition-all ${
                        goalType === type
                          ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {type === 'minutes' ? 'Minutos focados' : 'Sessões de foco'}
                    </button>
                  ))}
                </div>

                {(() => {
                  const limits = GOAL_LIMITS[goalType];
                  const value = goalType === 'minutes' ? goalMinutes : goalSessions;
                  const setValue = goalType === 'minutes' ? setGoalMinutes : setGoalSessions;
                  const change = (delta: number) =>
                    setValue(Math.min(limits.max, Math.max(limits.min, value + delta)));
                  return (
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => change(-limits.step)}
                        disabled={value <= limits.min}
                        aria-label="Diminuir meta"
                        className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="min-w-[8ch] text-center font-mono" aria-live="polite">
                        <span className="text-2xl font-bold tabular-nums">{value}</span>{' '}
                        <span className="text-xs text-zinc-500">{goalType === 'minutes' ? 'min/dia' : value === 1 ? 'foco/dia' : 'focos/dia'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => change(limits.step)}
                        disabled={value >= limits.max}
                        aria-label="Aumentar meta"
                        className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

            </>
          )}

          {/* Ações Inferiores */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-200/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs"
            >
              {initialHabit ? 'Salvar Alterações' : 'Criar Hábito'}
            </button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
};
