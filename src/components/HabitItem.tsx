import React from 'react';
import { Check, Flame, Pin, Eye, EyeOff, Edit3, Lock, ShieldCheck, ShieldOff } from 'lucide-react';
import { type Habit } from '@/types/habit';
import { HabitIcon } from './HabitIcon';
import { HabitCover } from './HabitCover';
import { coverOrFallback } from '@/lib/covers';
import { useHabits } from '@/context/HabitsContext';
import { useDiscreet, useSettings } from '@/context/SettingsContext';
import { getGoalLock, goalLabel, goalProgress } from '@/lib/pomoGoals';
import { getGraceBlock, graceRemaining, isGraced, monthKeyOf } from '@/lib/graces';
import { isWeeklyOn, weekStartKey, weekStatus } from '@/lib/weekly';
import { parseDateKey, toDateKey } from '@/lib/dateUtils';
import { avoidDayStatus, canSlipOn, isSlipped } from '@/lib/avoid';
import { calculateStreak, calculateBestStreak } from '@/lib/analytics';
import { highestMilestone } from '@/lib/milestones';

interface HabitItemProps {
  habit: Habit;
  isCompleted: boolean;
  onToggle: () => void;
  onEdit: () => void;
  variant?: 'list' | 'bento' | 'gallery';
}

const HabitItemBase: React.FC<HabitItemProps> = ({
  habit,
  isCompleted: isCompletedProp,
  onToggle,
  onEdit,
  variant = 'list'
}) => {
  const { logs, graces, slips, toggleHideTitle, pomoSessions, selectedDateKey, applyGrace, undoGrace, markSlip, undoSlip } =
    useHabits();
  const { settings } = useSettings();
  // Título oculto pela escolha do hábito (olho) ou pelo modo discreto global
  const { isHidden } = useDiscreet();
  const hidden = isHidden(habit);

  // Hábito a evitar: não tem check-in. O estado vem dos escorregões, e a ação é "Escorreguei"
  const avoid = habit.kind === 'avoid';
  const isCompleted = avoid ? false : isCompletedProp;

  // Hábito com meta do Pomo não cumprida: marcação bloqueada (o contexto avisa por toast ao tocar)
  const lock = isCompleted ? null : getGoalLock(habit, pomoSessions, selectedDateKey);

  const handleToggle = () => {
    if (avoid) return;
    if (!lock && settings.vibration && typeof navigator !== 'undefined') {
      navigator.vibrate?.(15);
    }
    onToggle();
  };
  const streak = calculateStreak(habit, logs, new Date(), graces, slips);
  const bestStreak = calculateBestStreak(habit, logs, new Date(), graces, slips);

  const now = new Date();
  const isToday = selectedDateKey === toDateKey(now);
  const slippedHere = avoid && isSlipped(slips, selectedDateKey, habit.id);
  const canSlip = avoid && canSlipOn(habit, selectedDateKey, now);
  const avoidStatus = avoid ? avoidDayStatus(habit, selectedDateKey, now, slips) : null;
  const avoidText =
    avoidStatus === 'slipped'
      ? isToday
        ? 'Escorregou hoje · amanhã recomeça'
        : 'Escorregou neste dia'
      : avoidStatus === 'in-progress'
      ? `Limpo há ${streak} ${streak === 1 ? 'dia' : 'dias'}`
      : avoidStatus === 'clean'
      ? 'Dia limpo'
      : avoidStatus === 'future'
      ? 'Ainda não aconteceu'
      : 'Fora da agenda';

  // Dia de graça: perdoa o dia sem quebrar a ofensiva (não conta como concluído)
  const perMonth = settings.graceDaysPerMonth;
  const graced = !isCompleted && isGraced(graces, selectedDateKey, habit.id);
  const graceBlock = getGraceBlock({
    habit,
    dateKey: selectedDateKey,
    today: new Date(),
    logs,
    graces,
    perMonth
  });
  const graceLeft = graceRemaining(habit.id, monthKeyOf(selectedDateKey), graces, perMonth);
  // Só aparece quando há ofensiva a proteger (evita poluir hábitos novos)
  const showGraceAction = !isCompleted && !graced && bestStreak > 0 && graceBlock === null;
  const showNoGrace = !isCompleted && !graced && bestStreak > 0 && graceBlock === 'no-quota';
  const graceButton =
    `relative text-[10px] font-mono underline underline-offset-2 text-left text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 before:absolute before:-inset-x-1 before:-inset-y-4 before:content-['']`;

  const isRecord = streak > 0 && streak === bestStreak;
  const isBroken = streak === 0 && bestStreak > 0;

  // Meta semanal: a ofensiva conta semanas e o hábito mostra o avanço da semana do dia exibido
  const selectedDate = parseDateKey(selectedDateKey);
  const weeklyHabit = isWeeklyOn(habit, new Date());
  const unit = weeklyHabit ? (streak === 1 ? 'semana' : 'semanas') : streak === 1 ? 'dia' : 'dias';
  const bestUnit = weeklyHabit ? (bestStreak === 1 ? 'semana' : 'semanas') : bestStreak === 1 ? 'dia' : 'dias';
  const week = isWeeklyOn(habit, selectedDate) ? weekStatus(habit, weekStartKey(selectedDate), logs, graces) : null;
  const isCurrentWeek = weekStartKey(selectedDate) === weekStartKey(new Date());
  // Meta da semana cumprida e hábito não feito hoje: continua marcável, com estilo mais leve
  const weekDone = Boolean(week?.met) && !isCompleted;

  // Meta diária com o Pomo (dia exibido na tela)
  const progress = habit.pomoGoal ? goalProgress(habit.pomoGoal, habit.id, pomoSessions, selectedDateKey) : null;

  // Variante "bento": células em grade; o hábito em destaque ocupa as 2 colunas e é maior
  const bento = variant === 'bento';
  const featured = Boolean(habit.featured); // fixado no topo, nos dois layouts
  const bentoFeatured = bento && featured;
  // Variante "galeria": capa em destaque no topo do cartão; conteúdo logo abaixo (contraste AA garantido)
  const gallery = variant === 'gallery';
  // Nome acessível dos botões: nunca vaza o título quando está oculto
  const label = hidden ? 'Hábito oculto' : habit.title;
  // Alvos de toque de 44px na célula (36px + área expandida), sem estourar a célula com texto grande
  const actionBtn = bento || gallery
    ? "relative w-9 h-9 flex items-center justify-center before:absolute before:-inset-1 before:content-['']"
    : 'p-1.5';

  const checkEl = (
    <>
        {/* Hábito a evitar: indicador de estado no lugar do checkbox */}
        {avoid ? (
          <div
            role="img"
            aria-label={avoidText}
            className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 ${
              slippedHere
                ? 'border-dashed border-zinc-400 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500'
                : avoidStatus === 'in-progress' || avoidStatus === 'clean'
                ? 'border-zinc-950 dark:border-zinc-50 text-zinc-950 dark:text-zinc-50'
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-300 dark:text-zinc-600'
            }`}
          >
            {slippedHere ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
        ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className={`relative w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 transition-colors duration-200 before:absolute before:-inset-2 before:content-[''] ${
            isCompleted
              ? 'text-zinc-50 dark:text-zinc-950 border-zinc-950 dark:border-zinc-50 shadow-xs'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 bg-zinc-50/50 dark:bg-zinc-800/40'
          }`}
          aria-label={
            isCompleted
              ? `Desmarcar ${label}`
              : lock
              ? `${label}: bloqueado até cumprir a meta do Pomo (${lock.label})`
              : `Marcar ${label}`
          }
          aria-disabled={lock ? true : undefined}
          title={lock ? `Cumpra a meta do Pomo para marcar (${lock.label})` : undefined}
        >
          {/* Preenchimento de baixo para cima (some com "reduzir animações" via index.css) */}
          <span aria-hidden="true" className="absolute inset-0 rounded-[11px] overflow-hidden pointer-events-none">
            <span
              className="absolute inset-0 bg-zinc-950 dark:bg-zinc-50 origin-bottom transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: isCompleted ? 'scaleY(1)' : 'scaleY(0)' }}
            />
          </span>
          <Check
            className={`relative w-4 h-4 stroke-[2.5] transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCompleted ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {lock && <Lock aria-hidden="true" className="absolute w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />}
        </button>
        )}

    </>
  );
  const iconEl = (
    <>
        {/* Ícone de Categoria */}
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
            isCompleted
              ? 'border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          {/* A capa só aparece no layout Capas; na lista e no bento fica o ícone simples */}
          <HabitIcon iconKey={habit.icon} className="w-4 h-4" />
        </div>

    </>
  );
  const titleEl = (
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <p
              className={`${bentoFeatured ? 'text-lg font-semibold' : featured ? 'text-base font-semibold' : 'text-sm font-medium'} tracking-tight break-words leading-snug ${
                isCompleted
                  ? 'line-through text-zinc-400 dark:text-zinc-500'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {hidden ? (
                <span className="font-mono tracking-widest text-xs opacity-60">•••••••••••</span>
              ) : (
                habit.title
              )}
              {featured && (
                <Pin aria-label="Fixado" className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5 text-zinc-500 dark:text-zinc-400" />
              )}
            </p>
          </div>
          {habit.description && !hidden && (
            <p
              className={`mt-0.5 text-xs leading-snug break-words text-zinc-500 dark:text-zinc-400 ${
                bentoFeatured ? 'line-clamp-2' : 'line-clamp-1'
              } ${isCompleted ? 'opacity-60' : ''}`}
            >
              {habit.description}
            </p>
          )}
        </div>
  );
  const actionsEl = (
    <>
      {/* Ações rápidas */}
        <div className="flex items-center gap-1 shrink-0">
        {/* Toggle Discreto (Olho) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleHideTitle(habit);
          }}
          className={`${actionBtn} rounded-lg opacity-60 hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors`}
          aria-label={habit.hideTitle ? 'Mostrar título do hábito' : 'Ocultar título do hábito'}
          title={habit.hideTitle ? 'Mostrar título do hábito' : 'Ocultar título do hábito'}
        >
          {habit.hideTitle ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>

        {/* Editar */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className={`${actionBtn} rounded-lg opacity-60 hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors`}
          aria-label="Editar hábito"
          title="Editar hábito"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>

        </div>
    </>
  );
  const infoEl = (
    <>
        {/* Linha de metadados: ofensiva · categoria · marco, tudo alinhado à esquerda do nome */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap min-w-0 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          <span
            title={`Atual: ${streak} ${unit} · Melhor: ${bestStreak} ${bestUnit}`}
            className={`inline-flex items-center gap-1 tabular-nums ${
              isRecord
                ? 'font-bold text-zinc-950 dark:text-zinc-50'
                : streak > 0
                ? 'font-semibold text-zinc-800 dark:text-zinc-200'
                : ''
            }`}
          >
            <Flame
              className={`w-3.5 h-3.5 shrink-0 ${
                streak > 0
                  ? 'text-zinc-950 dark:text-zinc-100 fill-zinc-950 dark:fill-zinc-100'
                  : 'text-zinc-400 dark:text-zinc-600'
              }`}
            />
            {streak}
            {weeklyHabit ? ' sem' : ''}
            {/* Hábito semanal ou a evitar: só a atual (a melhor fica no tooltip) */}
            {!weeklyHabit && !avoid && <span className="font-normal opacity-70">· melhor {bestStreak}</span>}
          </span>
          <span className="uppercase tracking-wider">{habit.category}</span>
          {highestMilestone(bestStreak) !== null && (
            <span
              className="leading-none px-1 py-0.5 rounded border border-zinc-400 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 shrink-0"
              title={`Marco: ${highestMilestone(bestStreak)} ${weeklyHabit ? 'semanas' : 'dias'}`}
              aria-label={`Marco atingido: ${highestMilestone(bestStreak)} ${weeklyHabit ? 'semanas' : 'dias'}`}
            >
              {highestMilestone(bestStreak)}
            </span>
          )}
        </div>
        {isBroken && (
          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
            Sua melhor continua em {bestStreak} {bestUnit}.
          </p>
        )}
          {progress && (
            <div className="mt-2 space-y-1">
              <span className="block text-[10px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                {goalLabel(progress)}
              </span>
              <div
                role="progressbar"
                aria-label="Meta com Pomo"
                aria-valuemin={0}
                aria-valuemax={progress.target}
                aria-valuenow={progress.current}
                className="h-1 w-full max-w-[160px] rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-zinc-950 dark:bg-zinc-50 transition-[width] duration-300"
                  style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                />
              </div>
            </div>
          )}
          {avoid && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 leading-tight">
                {avoidText}
                {avoidStatus === 'in-progress' && (
                  <span className="block text-zinc-400 dark:text-zinc-500">hoje em andamento</span>
                )}
              </p>
              {canSlip && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (slippedHere) void undoSlip(habit.id, selectedDateKey);
                    else void markSlip(habit.id, selectedDateKey);
                  }}
                  className="relative px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']"
                >
                  {slippedHere ? 'Desfazer' : 'Escorreguei'}
                </button>
              )}
            </div>
          )}
          {week && (
            <div className="mt-2 space-y-1">
              <span className="block text-[10px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                {week.count}/{week.target} {isCurrentWeek ? 'esta semana' : 'na semana'}
              </span>
              <div
                role="progressbar"
                aria-label="Meta da semana"
                aria-valuemin={0}
                aria-valuemax={week.target}
                aria-valuenow={Math.min(week.count, week.target)}
                className="h-1 w-full max-w-[160px] rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-zinc-950 dark:bg-zinc-50 transition-[width] duration-300"
                  style={{ width: `${Math.round(Math.min(1, week.count / week.target) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {graced && (
            <p className="mt-2 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 leading-tight">
              Graça usada ·{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void undoGrace(habit.id, selectedDateKey);
                }}
                className={graceButton}
              >
                Desfazer
              </button>
            </p>
          )}
          {showGraceAction && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void applyGrace(habit.id, selectedDateKey);
              }}
              className={`${graceButton} block mt-2 leading-tight`}
              aria-label={`Usar dia de graça: ${graceLeft} de ${perMonth} neste mês`}
            >
              Usar dia de graça ({graceLeft} de {perMonth} neste mês)
            </button>
          )}
          {showNoGrace && (
            <p className="mt-2 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 leading-tight">
              Sem dia de graça neste mês
            </p>
          )}
    </>
  );

  if (gallery) {
    // Concluído: scrim zinc + check grande (não depende só de cor); título riscado abaixo
    const cover = coverOrFallback(habit);
    return (
      <div
        onClick={handleToggle}
        className={`group relative flex flex-col h-full overflow-hidden rounded-2xl border transition-all select-none ${
          avoid ? 'cursor-default' : 'cursor-pointer'
        } ${graced || slippedHere ? '!border-dashed' : ''} ${
          featured && !isCompleted ? '!border-zinc-900 dark:!border-zinc-300' : ''
        } ${weekDone ? 'opacity-60' : ''} ${
          isCompleted
            ? 'bg-zinc-100/90 dark:bg-zinc-900/40 border-zinc-300/80 dark:border-zinc-800/60'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
        }`}
      >
        <HabitCover
          cover={cover}
          aspectRatio={featured ? 21 / 9 : 16 / 9}
          scale={featured ? 1 : 0.7}
          className="w-full shrink-0"
        >
          <span
            className={`absolute inset-0 flex items-center justify-center bg-zinc-950/60 transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCompleted ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Check className="w-10 h-10 stroke-[2.5] text-zinc-50" />
          </span>
          {/* Ícone sobre scrim zinc: legível (AA) sobre qualquer capa */}
          <span className="absolute left-2.5 bottom-2.5 w-8 h-8 rounded-xl flex items-center justify-center bg-zinc-950/80 text-zinc-50">
            <HabitIcon iconKey={habit.icon} className="w-4 h-4" />
          </span>
        </HabitCover>
        <div className="flex flex-col gap-2 p-3 flex-1">
          <div className="flex items-start gap-2.5">
            {checkEl}
            {titleEl}
            {actionsEl}
          </div>
          <div className="min-w-0">{infoEl}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleToggle}
      className={`group relative flex flex-col gap-2 rounded-2xl border transition-all select-none min-h-[58px] ${bento ? (bentoFeatured ? 'p-4 h-full' : 'p-3 h-full') : 'p-3.5 sm:p-4'} ${
        avoid ? 'cursor-default' : 'cursor-pointer'
      } ${
        graced || slippedHere ? '!border-dashed' : ''
      } ${featured && !isCompleted ? '!border-zinc-900 dark:!border-zinc-300' : ''} ${weekDone ? 'opacity-60' : ''} ${
        isCompleted
          ? 'bg-zinc-100/90 dark:bg-zinc-900/40 border-zinc-300/80 dark:border-zinc-800/60 opacity-90'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
      }`}
    >
      {bento ? (
        <>
          <div className="flex items-center gap-2">
            {checkEl}
            {bentoFeatured && iconEl}
            <div className="flex-1" />
            {actionsEl}
          </div>
          {titleEl}
          <div className="min-w-0">{infoEl}</div>
        </>
      ) : (
        <>
          {/* Linha 1: checkbox + ícone + nome completo + ações */}
          <div className="flex items-center gap-3.5">
            {checkEl}
            {iconEl}
            {titleEl}
            {actionsEl}
          </div>

          {/* Linha 2: ofensiva e demais informações, alinhadas sob o nome */}
          <div className="pl-[88px] min-w-0">{infoEl}</div>
        </>
      )}
    </div>
  );
};

export const HabitItem = React.memo(HabitItemBase);
