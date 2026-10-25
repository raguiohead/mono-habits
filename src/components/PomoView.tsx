import React, { useEffect, useMemo, useState } from 'react';
import { Play, Pause, Square, Minus, Plus, Check, X } from 'lucide-react';
import { TomatoIcon } from './TomatoIcon';
import { useHabits } from '@/context/HabitsContext';
import { usePomo } from '@/context/PomoContext';
import { toDateKey } from '@/lib/dateUtils';
import {
  FOCUS_BEFORE_LONG_BREAK,
  KIND_LABEL,
  MAX_MINUTES,
  MIN_MINUTES,
  PRESETS,
  formatClock,
  formatDuration,
  summarizeDay
} from '@/lib/pomo';
import { goalLabel, goalProgress } from '@/lib/pomoGoals';
import { useDiscreet } from '@/context/SettingsContext';
import { type Habit, type PomoGoal, type PomoKind } from '@/types/habit';

const KINDS: PomoKind[] = ['focus', 'short', 'long'];
const RING_RADIUS = 104;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Nome do hábito sem vazar o título quando ele está oculto (Modo Discreto) */
const habitName = (h: Habit, hidden: boolean) => (hidden ? `••••• (${h.category})` : h.title);

const goalTarget = (goal: PomoGoal) =>
  goal.type === 'minutes' ? `${goal.target} min/dia` : `${goal.target} ${goal.target === 1 ? 'foco' : 'focos'}/dia`;

export const PomoView: React.FC = () => {
  const { pomoSessions, activeHabits } = useHabits();
  const { isHidden } = useDiscreet();
  const {
    kind,
    durations,
    cycleCount,
    status,
    remainingSeconds,
    totalSeconds,
    start,
    pause,
    resume,
    stop,
    selectKind,
    setMinutes,
    linkableHabits,
    linkedHabitId,
    setLinkedHabit
  } = usePomo();

  const idle = status === 'idle';
  const minutes = durations[kind];

  // Campo numérico editável sem "brigar" com a digitação
  const [draft, setDraft] = useState(String(minutes));
  useEffect(() => setDraft(String(minutes)), [minutes]);
  const commitDraft = () => {
    const n = parseInt(draft, 10);
    if (Number.isNaN(n)) setDraft(String(minutes));
    else setMinutes(kind, n);
  };

  const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;

  const todayKey = toDateKey(new Date());
  const summary = useMemo(() => summarizeDay(pomoSessions, todayKey), [pomoSessions, todayKey]);
  const history = useMemo(() => pomoSessions.slice(0, 8), [pomoSessions]);

  return (
    <div className="space-y-6">
      {/* Seletor de tipo */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={!idle}
            onClick={() => selectKind(k)}
            className={`flex-1 py-2 px-2 rounded-lg transition-all text-center disabled:cursor-not-allowed ${
              kind === k
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 enabled:hover:text-zinc-900 dark:enabled:hover:text-zinc-200 disabled:opacity-50'
            }`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {/* Relógio */}
      <div className="p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs flex flex-col items-center gap-5">
        <div className="relative w-60 h-60">
          <svg viewBox="0 0 240 240" className="w-full h-full -rotate-90">
            <circle
              cx="120"
              cy="120"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="6"
              className="stroke-zinc-100 dark:stroke-zinc-800"
            />
            <circle
              cx="120"
              cy="120"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - progress)}
              className="stroke-zinc-950 dark:stroke-zinc-50 transition-[stroke-dashoffset] duration-300 ease-linear"
            />
          </svg>
          <div
            role="timer"
            aria-live="off"
            aria-label={`Temporizador: ${formatClock(remainingSeconds)}`}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1"
          >
            <TomatoIcon
              className={`w-6 h-6 text-zinc-400 dark:text-zinc-500 ${status === 'running' ? 'animate-pulse' : ''}`}
            />
            <span className="font-mono text-5xl font-bold tracking-tighter tabular-nums">
              {formatClock(remainingSeconds)}
            </span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              {status === 'paused' ? 'Pausado' : KIND_LABEL[kind]}
            </span>
          </div>
          {/* Anúncio acessível de alteração de estado (não verboso, apenas em transições) */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {status === 'paused' ? 'Temporizador pausado' : status === 'running' ? `Temporizador em andamento: ${KIND_LABEL[kind]}` : 'Temporizador pronto'}
          </div>
        </div>

        {/* Ciclo */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: FOCUS_BEFORE_LONG_BREAK }).map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full border ${
                  i < cycleCount
                    ? 'bg-zinc-950 border-zinc-950 dark:bg-zinc-50 dark:border-zinc-50'
                    : 'border-zinc-300 dark:border-zinc-700'
                }`}
              />
            ))}
          </div>
          <span>
            ciclo {Math.min(cycleCount + (kind === 'focus' ? 1 : 0), FOCUS_BEFORE_LONG_BREAK)}/{FOCUS_BEFORE_LONG_BREAK}
          </span>
        </div>

        {/* Hábito vinculado à sessão em andamento */}
        {!idle && kind === 'focus' && linkedHabitId && (() => {
          const linked = activeHabits.find((h) => h.id === linkedHabitId);
          return linked?.pomoGoal ? (
            <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 text-center">
              Vinculado a {habitName(linked, isHidden(linked))} · meta {goalTarget(linked.pomoGoal)}
            </p>
          ) : null;
        })()}

        {/* Ajuste do tempo (somente ocioso) */}
        {idle && (
          <div className="w-full space-y-3">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setMinutes(kind, minutes - 5)}
                disabled={minutes <= MIN_MINUTES}
                className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                aria-label="Diminuir 5 minutos"
              >
                <Minus className="w-4 h-4" />
              </button>
              <label className="flex items-baseline gap-1.5 font-mono">
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_MINUTES}
                  max={MAX_MINUTES}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitDraft}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="w-16 text-center text-2xl font-bold bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:border-zinc-950 dark:focus:border-zinc-50 outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  aria-label="Minutos"
                />
                <span className="text-xs text-zinc-600 dark:text-zinc-400">min</span>
              </label>
              <button
                type="button"
                onClick={() => setMinutes(kind, minutes + 5)}
                disabled={minutes >= MAX_MINUTES}
                className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                aria-label="Aumentar 5 minutos"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {PRESETS[kind].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMinutes(kind, p)}
                  className={`px-3 py-1 rounded-full text-[11px] font-mono border transition-colors ${
                    minutes === p
                      ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Vincular o foco a um hábito com meta (somente ocioso, em foco) */}
        {idle && kind === 'focus' && linkableHabits.length > 0 && (
          <div className="w-full space-y-1.5">
            <label htmlFor="pomo-habit" className="block text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Vincular a hábito
            </label>
            <select
              id="pomo-habit"
              value={linkedHabitId ?? ''}
              onChange={(e) => setLinkedHabit(e.target.value || null)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm"
            >
              <option value="">Sem vínculo</option>
              {linkableHabits.map((h) => (
                <option key={h.id} value={h.id}>
                  {habitName(h, isHidden(h))} — {goalLabel(goalProgress(h.pomoGoal!, h.id, pomoSessions, todayKey))}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Controles */}
        <div className="flex items-center gap-3">
          {idle ? (
            <button
              type="button"
              onClick={start}
              className="px-8 h-12 rounded-2xl bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 text-sm font-medium flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-xs"
            >
              <Play className="w-4 h-4 fill-current" />
              Iniciar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={status === 'running' ? pause : resume}
                className="px-7 h-12 rounded-2xl bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 text-sm font-medium flex items-center gap-2 active:scale-95 transition-all shadow-xs"
              >
                {status === 'running' ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Retomar
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={stop}
                className="px-5 h-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm font-medium flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
                aria-label="Encerrar e registrar como interrompida"
              >
                <Square className="w-3.5 h-3.5" />
                Encerrar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Resumo de hoje */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Focos hoje', value: String(summary.focusSessions) },
          { label: 'Tempo focado', value: formatDuration(summary.focusSeconds) },
          { label: 'Interrompidas', value: String(summary.interrupted) }
        ].map((item) => (
          <div
            key={item.label}
            className="p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              {item.label}
            </span>
            <p className="text-xl font-bold font-mono mt-1.5">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Histórico */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Histórico
        </h3>
        {history.length === 0 ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 py-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            Nenhuma sessão registrada ainda. Inicie seu primeiro foco.
          </p>
        ) : (
          <ul className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
            {history.map((s) => {
              const d = new Date(s.startedAt);
              const sameDay = toDateKey(d) === todayKey;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs font-mono">
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="w-4 h-4 shrink-0 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                      {s.completed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </span>
                    <span
                      className="font-sans text-sm font-medium whitespace-nowrap"
                      title={s.completed ? 'Concluída' : 'Interrompida'}
                    >
                      {KIND_LABEL[s.kind]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 min-w-0 text-zinc-600 dark:text-zinc-400">
                    <span className="tabular-nums">
                      {formatClock(s.actualSeconds)}
                      {!s.completed && ` / ${formatClock(s.plannedSeconds)}`}
                    </span>
                    <span className="tabular-nums text-right whitespace-nowrap">
                      {sameDay
                        ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) +
                          ' ' +
                          d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
