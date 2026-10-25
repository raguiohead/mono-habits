import React, { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';
import { toDateKey, addDays, getStartOfWeek, DAYS_SHORT } from '@/lib/dateUtils';
import { type WeekDay } from '@/types/habit';

export const WeeklyStrip: React.FC = () => {
  const {
    selectedDateKey,
    setSelectedDateKey,
    weekOffset,
    setWeekOffset,
    logs
  } = useHabits();

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  // Touch Swipe para alternar semanas no mobile
  const touchStartXRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartXRef.current;
    const minSwipeDistance = 50;

    if (diff > minSwipeDistance) {
      // Swipe para a direita -> Semana anterior
      setWeekOffset((prev) => prev - 1);
    } else if (diff < -minSwipeDistance) {
      // Swipe para a esquerda -> Próxima semana
      setWeekOffset((prev) => prev + 1);
    }

    touchStartXRef.current = null;
  };

  const weekDays: WeekDay[] = useMemo(() => {
    const start = addDays(getStartOfWeek(today), weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const key = toDateKey(date);
      return {
        date,
        key,
        dayName: DAYS_SHORT[date.getDay()],
        dayNumber: date.getDate(),
        isToday: key === todayKey,
        isFuture: key > todayKey
      };
    });
  }, [today, todayKey, weekOffset]);

  const hasCompletionsOnDay = (dateKey: string) => {
    const completed = logs[dateKey];
    return Array.isArray(completed) && completed.length > 0;
  };

  return (
    <div
      className="py-2 select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Navegador Semanal */}
      <div className="flex items-center justify-between mb-3 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            {weekOffset === 0 ? 'Esta Semana' : weekOffset < 0 ? `${Math.abs(weekOffset)} sem. atrás` : `+${weekOffset} sem. à frente`}
          </span>
          {weekOffset !== 0 && (
            <button
              onClick={() => {
                setWeekOffset(0);
                setSelectedDateKey(todayKey);
              }}
              className="min-h-[44px] px-2.5 py-1 flex items-center rounded-md text-[10px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              Hoje
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Semana anterior (Swipe direita)"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
          </button>
          <button
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Próxima semana (Swipe esquerda)"
            aria-label="Próxima semana"
          >
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Grade de 7 Dias */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekDays.map((item) => {
          const isSelected = item.key === selectedDateKey;
          const hasDone = hasCompletionsOnDay(item.key);

          return (
            <button
              key={item.key}
              onClick={() => setSelectedDateKey(item.key)}
              className={`flex flex-col items-center justify-center py-2.5 sm:py-3 rounded-xl border transition-all text-center relative ${
                isSelected
                  ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50 shadow-sm'
                  : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <span className={`text-[10px] font-mono uppercase ${isSelected ? 'opacity-80' : ''}`}>
                {item.dayName}
              </span>
              <span className="text-sm font-semibold font-mono mt-0.5">
                {item.dayNumber}
              </span>

              {/* Indicador de Conclusão / Atividade */}
              <div className="h-1.5 mt-1 flex items-center justify-center">
                {hasDone ? (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected
                        ? 'bg-zinc-400 dark:bg-zinc-600'
                        : 'bg-zinc-900 dark:bg-zinc-100'
                    }`}
                  />
                ) : item.isToday ? (
                  <span
                    className={`w-1 h-1 rounded-full ${
                      isSelected
                        ? 'bg-zinc-500 dark:bg-zinc-400'
                        : 'bg-zinc-400 dark:bg-zinc-500'
                    }`}
                  />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
