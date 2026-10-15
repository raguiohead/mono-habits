import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, Fingerprint, Lock } from 'lucide-react';
import { LogoMark } from './LogoMark';
import { getStoredTheme } from '@/lib/storage';
import { PIN_MAX_LENGTH } from '@/lib/lock';
import { type PinCheck } from '@/context/LockContext';

interface LockScreenProps {
  pinLength: number;
  biometricEnabled: boolean;
  onSubmitPin: (pin: string) => Promise<PinCheck>;
  onBiometric: () => Promise<boolean>;
  onErase: () => void;
  /** Atraso ainda pendente de tentativas erradas anteriores (persistido) */
  initialRemainingMs: number;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const formatSeconds = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
};

/**
 * Tela cheia de bloqueio, monocromática, com teclado numérico grande.
 * Fica fora dos provedores de dados: nada do conteúdo do app é montado enquanto ela aparece.
 */
export const LockScreen: React.FC<LockScreenProps> = ({
  pinLength,
  biometricEnabled,
  onSubmitPin,
  onBiometric,
  onErase,
  initialRemainingMs
}) => {
  const [digits, setDigits] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [blockedUntil, setBlockedUntil] = useState(() => Date.now() + initialRemainingMs);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const busyRef = useRef(false);

  // O bloqueio é montado acima do provedor de dados, então aplica o tema salvo aqui
  useEffect(() => {
    document.documentElement.classList.toggle('dark', getStoredTheme());
  }, []);

  // Contagem regressiva do atraso entre tentativas
  useEffect(() => {
    if (blockedUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [blockedUntil]);

  const remaining = Math.max(0, blockedUntil - now);
  const blocked = remaining > 0;

  const submit = useCallback(
    async (pin: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      const result = await onSubmitPin(pin);
      busyRef.current = false;
      setBusy(false);
      if (result.ok) return; // o provedor desbloqueia e remove esta tela
      setDigits('');
      const until = Date.now() + result.remainingMs;
      setBlockedUntil(until);
      setNow(Date.now());
      setMessage(result.reason === 'wrong' ? 'PIN incorreto.' : 'Aguarde para tentar de novo.');
    },
    [onSubmitPin]
  );

  const press = useCallback(
    (digit: string) => {
      if (busyRef.current || Date.now() < blockedUntil) return;
      setMessage(null);
      setDigits((prev) => {
        if (prev.length >= PIN_MAX_LENGTH) return prev;
        const next = prev + digit;
        // Desbloqueio automático ao completar o tamanho do PIN
        if (next.length === pinLength) void submit(next);
        return next;
      });
    },
    [blockedUntil, pinLength, submit]
  );

  const backspace = useCallback(() => {
    if (busyRef.current) return;
    setMessage(null);
    setDigits((prev) => prev.slice(0, -1));
  }, []);

  // Teclado físico
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showForgot) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') backspace();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, backspace, showForgot]);

  const tryBiometric = async () => {
    setMessage(null);
    const ok = await onBiometric();
    if (!ok) setMessage('Não foi possível usar a biometria. Digite o PIN.');
  };

  const keyClass =
    'h-16 w-16 sm:h-[72px] sm:w-[72px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xl font-mono font-medium flex items-center justify-center select-none transition-colors active:bg-zinc-100 dark:active:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 disabled:opacity-40 disabled:pointer-events-none';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-title"
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#FAFAFA] dark:bg-[#09090B] text-[#09090B] dark:text-[#FAFAFA]"
    >
      <div className="min-h-full flex flex-col items-center justify-center gap-6 px-6 py-10">
        <LogoMark className="w-12 h-12" />

        <div className="text-center space-y-1">
          <h1 id="lock-title" className="text-base font-semibold tracking-tight flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" aria-hidden="true" />
            App bloqueado
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Digite seu PIN para continuar.</p>
        </div>

        {/* Pontos do PIN */}
        <div
          className="flex items-center gap-3"
          role="img"
          aria-label={`${digits.length} de ${pinLength} dígitos digitados`}
        >
          {Array.from({ length: pinLength }).map((_, i) => (
            <span
              key={i}
              className={`w-3.5 h-3.5 rounded-full border transition-colors ${
                i < digits.length
                  ? 'bg-zinc-950 border-zinc-950 dark:bg-zinc-50 dark:border-zinc-50'
                  : 'border-zinc-400 dark:border-zinc-600'
              }`}
            />
          ))}
        </div>

        <p role="alert" aria-live="assertive" className="min-h-[2.5rem] text-center text-xs font-mono">
          {blocked ? (
            <>
              {message ?? 'Muitas tentativas.'}
              <span className="block text-zinc-500 dark:text-zinc-400">
                Tente novamente em {formatSeconds(remaining)}.
              </span>
            </>
          ) : (
            message
          )}
        </p>

        {/* Teclado numérico */}
        <div className="grid grid-cols-3 gap-3" role="group" aria-label="Teclado numérico">
          {KEYS.map((k) => (
            <button key={k} type="button" className={keyClass} disabled={blocked || busy} onClick={() => press(k)}>
              {k}
            </button>
          ))}
          {biometricEnabled ? (
            <button
              type="button"
              className={keyClass}
              onClick={() => void tryBiometric()}
              disabled={busy}
              aria-label="Desbloquear com biometria"
            >
              <Fingerprint className="w-6 h-6" />
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          <button type="button" className={keyClass} disabled={blocked || busy} onClick={() => press('0')}>
            0
          </button>
          <button
            type="button"
            className={keyClass}
            onClick={backspace}
            disabled={busy || digits.length === 0}
            aria-label="Apagar último dígito"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Esqueci o PIN */}
        {!showForgot ? (
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="min-h-[44px] px-3 text-xs font-mono underline underline-offset-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50"
          >
            Esqueci o PIN
          </button>
        ) : (
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 text-xs leading-relaxed">
            <p className="font-medium">Esqueci o PIN</p>
            <p className="text-zinc-600 dark:text-zinc-400">
              O PIN não pode ser recuperado. Se você usa a Conta Google, seus hábitos continuam na nuvem: ao apagar os
              dados deste dispositivo e entrar de novo com a mesma conta, eles são restaurados. Dados que existem só
              neste aparelho (sem conta conectada) serão perdidos.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              Lembrete: este bloqueio é uma trava de interface. Os dados no navegador não são criptografados.
            </p>
            {!confirmErase ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="flex-1 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmErase(true)}
                  className="flex-1 min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-700 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Apagar dados deste dispositivo
                </button>
              </div>
            ) : (
              <div className="space-y-2" role="alertdialog" aria-label="Confirmar apagar dados">
                <p className="font-medium">Tem certeza? Isso apaga os hábitos, registros e o PIN deste aparelho.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmErase(false)}
                    className="flex-1 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={onErase}
                    className="flex-1 min-h-[44px] rounded-xl bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 font-medium"
                  >
                    Sim, apagar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
