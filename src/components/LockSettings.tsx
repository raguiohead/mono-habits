import React, { useState } from 'react';
import { Lock, Fingerprint } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';
import { useAppLock, type PinCheck } from '@/context/LockContext';
import { BTN, BTN_PRIMARY, SectionTitle, Switch } from './settingsControls';
import { LOCK_TIMEOUT_OPTIONS, PIN_MAX_LENGTH, PIN_MIN_LENGTH, isValidPin, type LockTimeout } from '@/lib/lock';

type View = 'idle' | 'setup' | 'change' | 'disable';

const TIMEOUT_LABEL: Record<LockTimeout, string> = { 0: 'Imediato', 1: '1 min', 5: '5 min', 15: '15 min' };

const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH);

const PinField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}> = ({ id, label, value, onChange, autoFocus }) => (
  <div className="space-y-1">
    <label htmlFor={id} className="block text-xs font-medium">
      {label}
    </label>
    <input
      id={id}
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      maxLength={PIN_MAX_LENGTH}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(onlyDigits(e.target.value))}
      className="w-full min-h-[44px] px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-mono tracking-[0.4em] outline-none focus:border-zinc-950 dark:focus:border-zinc-50"
    />
  </div>
);

function describeFailure(result: Extract<PinCheck, { ok: false }>): string {
  const wait = result.remainingMs > 0 ? ` Aguarde ${Math.ceil(result.remainingMs / 1000)} s para tentar de novo.` : '';
  if (result.reason === 'locked') return `Muitas tentativas.${wait}`;
  if (result.reason === 'wrong') return `PIN incorreto.${wait}`;
  return 'PIN inválido.';
}

/** Configurações > Privacidade: bloqueio do app por PIN e biometria (local, sem servidor) */
export const LockSettings: React.FC = () => {
  const { showToast } = useHabits();
  const lock = useAppLock();
  const [view, setView] = useState<View>('idle');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setView('idle');
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  };

  const validateNew = (): boolean => {
    if (!isValidPin(next)) {
      setError(`Use de ${PIN_MIN_LENGTH} a ${PIN_MAX_LENGTH} dígitos.`);
      return false;
    }
    if (next !== confirm) {
      setError('Os PINs não coincidem.');
      return false;
    }
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (view === 'setup') {
        if (!validateNew()) return;
        if (await lock.setupPin(next)) {
          showToast('Bloqueio ativado. O app pedirá o PIN ao abrir.');
          reset();
        } else {
          setError('Não foi possível salvar o PIN.');
        }
      } else if (view === 'change') {
        if (!validateNew()) return;
        const result = await lock.changePin(current, next);
        if (result.ok) {
          showToast('PIN alterado.');
          reset();
        } else {
          setError(describeFailure(result));
        }
      } else if (view === 'disable') {
        const result = await lock.disableLock(current);
        if (result.ok) {
          showToast('Bloqueio desativado.');
          reset();
        } else {
          setError(describeFailure(result));
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleBiometric = async (on: boolean) => {
    if (!on) {
      lock.disableBiometric();
      showToast('Biometria desativada.');
      return;
    }
    const ok = await lock.enableBiometric();
    showToast(ok ? 'Biometria ativada.' : 'Não foi possível cadastrar a biometria neste aparelho.');
  };

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4" aria-labelledby="lock-settings-title">
      <span id="lock-settings-title" className="sr-only">
        Privacidade: bloqueio do app
      </span>
      <SectionTitle icon={<Lock className="w-3.5 h-3.5" />}>Privacidade · bloqueio do app</SectionTitle>

      <Switch
        label="Bloquear o app com PIN"
        description="Pede o PIN ao abrir o app e ao voltar do segundo plano."
        checked={lock.enabled}
        onChange={(on) => {
          reset();
          setView(on ? 'setup' : 'disable');
        }}
      />

      {view !== 'idle' && (
        <form
          onSubmit={submit}
          className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 space-y-3"
        >
          {view === 'setup' && (
            <>
              <PinField id="lock-new" label={`Crie um PIN de ${PIN_MIN_LENGTH} a ${PIN_MAX_LENGTH} dígitos`} value={next} onChange={setNext} autoFocus />
              <PinField id="lock-confirm" label="Repita o PIN" value={confirm} onChange={setConfirm} />
            </>
          )}
          {view === 'change' && (
            <>
              <PinField id="lock-current" label="PIN atual" value={current} onChange={setCurrent} autoFocus />
              <PinField id="lock-new" label="Novo PIN" value={next} onChange={setNext} />
              <PinField id="lock-confirm" label="Repita o novo PIN" value={confirm} onChange={setConfirm} />
            </>
          )}
          {view === 'disable' && (
            <PinField id="lock-current" label="Digite seu PIN para desativar o bloqueio" value={current} onChange={setCurrent} autoFocus />
          )}
          {error && (
            <p role="alert" className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={reset} className={`${BTN} flex-1`}>
              Cancelar
            </button>
            <button type="submit" disabled={busy} className={`${BTN_PRIMARY} flex-1 disabled:opacity-50`}>
              {view === 'setup' ? 'Ativar bloqueio' : view === 'change' ? 'Alterar PIN' : 'Desativar'}
            </button>
          </div>
        </form>
      )}

      {lock.enabled && view === 'idle' && (
        <>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Bloquear depois de ficar em segundo plano por</p>
            <div
              role="radiogroup"
              aria-label="Tempo até bloquear"
              className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
            >
              {LOCK_TIMEOUT_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  role="radio"
                  aria-checked={lock.timeoutMinutes === minutes}
                  onClick={() => lock.setTimeoutMinutes(minutes)}
                  className={`min-h-[44px] rounded-lg text-xs transition-colors ${
                    lock.timeoutMinutes === minutes
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {TIMEOUT_LABEL[minutes]}
                </button>
              ))}
            </div>
          </div>

          {lock.biometricSupported && (
            <Switch
              label="Desbloquear com biometria"
              description="Usa a biometria ou o bloqueio de tela do aparelho (WebAuthn). O PIN continua valendo."
              checked={lock.biometricEnabled}
              onChange={(on) => void toggleBiometric(on)}
            />
          )}
          {lock.biometricSupported === false && (
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <Fingerprint className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Biometria indisponível neste navegador ou aparelho.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setView('change')} className={BTN}>
              Alterar PIN
            </button>
            <button type="button" onClick={lock.lockNow} className={BTN}>
              Bloquear agora
            </button>
          </div>
        </>
      )}

      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <strong>Trava de interface, não criptografia.</strong> O bloqueio impede que outra pessoa use o app aberto neste
        aparelho, mas os dados no armazenamento do navegador <strong>não são criptografados</strong>: quem tiver acesso ao
        navegador consegue lê-los. O PIN fica guardado só neste aparelho, como hash (PBKDF2 com sal), e não pode ser
        recuperado. Se esquecer, é preciso apagar os dados do dispositivo (a Conta Google restaura os dados da nuvem).
      </p>
    </section>
  );
};
