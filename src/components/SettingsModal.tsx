import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  X,
  UserCheck,
  LogOut,
  Cloud,
  CheckCircle2,
  Accessibility,
  Bell,
  Flame,
  ShieldCheck,
  Download,
  Trash2,
  ArrowLeft,
  FileText,
  LayoutGrid,
  HelpCircle,
  RefreshCw,
  EyeOff,
  ChevronDown
} from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { exportLocalData } from '@/lib/storage';
import {
  checkNativeExactAlarm,
  getPermission,
  openNativeExactAlarmSetting,
  refreshNativePermission,
  requestPermission,
  showSystemNotification
} from '@/lib/notifications';
import { fetchLatestRelease, isNewerVersion, setLastUpdateCheckAt } from '@/lib/appUpdate';
import { isValidTime, type DiscreetMode, type FocusLayout, type MotionPref, type TextSize } from '@/lib/settings';
import { Avatar } from './Avatar';
import { ModalShell } from './ModalShell';
import { BTN, BTN_PRIMARY, SectionTitle, Switch } from './settingsControls';
import { LockSettings } from './LockSettings';
import { PrivacyContent } from './PrivacyPolicy';
import { HelpView } from './HelpView';
import { dispatchShowUpdateNotice } from './UpdateNotice';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[44px] rounded-lg text-xs transition-colors ${
            value === o.value
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 font-semibold shadow-xs'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const GRACE_OPTIONS: { value: '0' | '1' | '2'; label: string }[] = [
  { value: '0', label: 'Desativado' },
  { value: '1', label: '1 por mês' },
  { value: '2', label: '2 por mês' }
];

const TEXT_OPTIONS: { value: TextSize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Grande' },
  { value: 'xlarge', label: 'Muito grande' }
];

const DISCREET_OPTIONS: { value: DiscreetMode; label: string }[] = [
  { value: 'off', label: 'Desligado' },
  { value: 'on', label: 'Ligado' },
  { value: 'auto', label: 'Automático' }
];

const LAYOUT_OPTIONS: { value: FocusLayout; label: string }[] = [
  { value: 'list', label: 'Lista' },
  { value: 'bento', label: 'Bento' },
  { value: 'gallery', label: 'Capas' }
];

const MOTION_OPTIONS: { value: MotionPref; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'reduce', label: 'Reduzido' },
  { value: 'full', label: 'Completo' }
];

type Confirm = 'device' | 'account' | null;

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, loginWithGoogle, logout, deleteAccount, clearDeviceData, showToast } = useHabits();
  const { settings, updateSettings } = useSettings();
  const [view, setView] = useState<'main' | 'privacy' | 'help'>('main');
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [permission, setPermission] = useState(getPermission());
  const [exactAlarmGranted, setExactAlarmGranted] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !Capacitor.isNativePlatform()) return;
    let alive = true;
    const refreshNativePermissions = () => {
      void checkNativeExactAlarm().then((ok) => alive && setExactAlarmGranted(ok));
      void refreshNativePermission().then((p) => alive && setPermission(p));
    };
    refreshNativePermissions();
    document.addEventListener('visibilitychange', refreshNativePermissions);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', refreshNativePermissions);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isGoogle = Boolean(user && !user.isAnonymous);
  const close = () => {
    setView('main');
    setConfirm(null);
    onClose();
  };

  const checkUpdatesNow = async () => {
    setCheckingUpdate(true);
    setLastUpdateCheckAt(Date.now());
    const latest = await fetchLatestRelease();
    setCheckingUpdate(false);
    if (!latest) {
      showToast('Não foi possível verificar atualizações agora.');
      return;
    }
    if (isNewerVersion(__APP_VERSION__, latest.version)) {
      close();
      dispatchShowUpdateNotice(latest);
    } else {
      showToast('Você está na versão mais recente.');
    }
  };

  // Notificações do navegador exigem permissão explícita
  const ensurePermission = async (): Promise<boolean> => {
    const current = await (getPermission() === 'granted' ? Promise.resolve('granted' as const) : requestPermission());
    setPermission(current);
    if (current === 'granted') return true;
    showToast(
      current === 'unsupported'
        ? 'Este navegador não suporta notificações.'
        : 'Permissão negada. Libere as notificações nas configurações do navegador.'
    );
    return false;
  };

  const toggleReminder = async (next: boolean) => {
    if (next && !(await ensurePermission())) return;
    updateSettings({ reminderEnabled: next });
  };

  const togglePomoAlerts = async (next: boolean) => {
    if (next && getPermission() !== 'granted') {
      // O alerta é opcional: o app segue funcionando com toast/som caso a permissão seja negada
      await ensurePermission();
    }
    updateSettings({ pomoAlerts: next });
  };

  const sendTest = async () => {
    if (!(await ensurePermission())) return;
    const ok = await showSystemNotification('MONO // HABITS', 'Notificações funcionando.', 'test');
    showToast(ok ? 'Notificação de teste enviada.' : 'Não foi possível exibir a notificação.');
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(exportLocalData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mono-habits-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Dados exportados.');
  };

  const runDeleteAccount = async () => {
    setBusy(true);
    await deleteAccount(); // recarrega a página em caso de sucesso
    setBusy(false);
    setConfirm(null);
  };

  if (view === 'help') {
    return (
      <ModalShell labelledBy="help-title" onClose={close} widthClass="sm:max-w-lg">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-zinc-200/80 dark:border-zinc-800">
          <button type="button" onClick={() => setView('main')} className="w-11 h-11 -ml-2 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Voltar às configurações">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 id="help-title" className="text-sm font-semibold tracking-tight flex-1">Ajuda</h3>
          <button type="button" onClick={close} className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <HelpView />
      </ModalShell>
    );
  }

  if (view === 'privacy') {
    return (
      <ModalShell labelledBy="privacy-title" onClose={close} widthClass="sm:max-w-lg">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-zinc-200/80 dark:border-zinc-800">
          <button type="button" onClick={() => setView('main')} className="w-11 h-11 -ml-2 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Voltar às configurações">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 id="privacy-title" className="text-sm font-semibold tracking-tight flex-1">Política de Privacidade</h3>
          <button type="button" onClick={close} className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <PrivacyContent />
        <p className="pt-4 text-[11px] text-zinc-500 dark:text-zinc-400">
          Link público: <a href="/privacidade" className="underline">/privacidade</a>
        </p>
      </ModalShell>
    );
  }

  return (
    <ModalShell labelledBy="settings-title" onClose={close}>
      <div className="space-y-4">
        {/* Topo */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-zinc-800">
          <div>
            <h3 id="settings-title" className="text-base font-semibold tracking-tight">Configurações</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Conta, aparência, acessibilidade e notificações</p>
          </div>
          <button type="button" onClick={close} className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl opacity-70 hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Fechar configurações">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conta */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4">
          <SectionTitle icon={<Cloud className="w-3.5 h-3.5" />}>Conta e sincronização</SectionTitle>

          {isGoogle && user && (
            <div className="flex items-center gap-3">
              <Avatar photoURL={user.photoURL} name={user.displayName || user.email} className="w-12 h-12" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user.displayName || 'Conta Google'}</p>
                {user.email && <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>}
              </div>
            </div>
          )}

          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 font-mono text-xs flex items-center justify-between gap-2">
            <span className="opacity-60 text-[11px]">STATUS:</span>
            <span className="font-semibold flex items-center gap-1.5">
              {isGoogle ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                  CONECTADO COM GOOGLE
                </>
              ) : isFirebaseConfigured ? (
                'MODO LOCAL'
              ) : (
                'MODO LOCAL OFFLINE'
              )}
            </span>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {isGoogle
              ? 'Seus hábitos e check-ins estão sincronizados com sua conta Google em todos os seus dispositivos.'
              : isFirebaseConfigured
              ? 'Conecte sua Conta Google para acessar seus hábitos de qualquer dispositivo e manter um backup permanente.'
              : 'Você está no modo local: tudo fica salvo apenas neste navegador.'}
          </p>

          {isGoogle ? (
            <button type="button" onClick={logout} className={`${BTN} w-full`}>
              <LogOut className="w-3.5 h-3.5" />
              Sair da conta
            </button>
          ) : (
            <button type="button" onClick={loginWithGoogle} className={`${BTN_PRIMARY} w-full`}>
              <UserCheck className="w-4 h-4" />
              Conectar com Google
            </button>
          )}
        </section>

        {/* Ajuda */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4">
          <SectionTitle icon={<HelpCircle className="w-3.5 h-3.5" />}>Ajuda</SectionTitle>
          <button type="button" onClick={() => setView('help')} className={`${BTN} w-full justify-between`}>
            <span className="flex items-center gap-2">
              Perguntas e glossário
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-400 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300">NOVO</span>
            </span>
            <span aria-hidden="true">›</span>
          </button>
          {Capacitor.isNativePlatform() && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                Versão {__APP_VERSION__}
              </span>
              <button
                type="button"
                disabled={checkingUpdate}
                onClick={checkUpdatesNow}
                className={`${BTN} disabled:opacity-50`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
                {checkingUpdate ? 'Verificando…' : 'Verificar atualizações'}
              </button>
            </div>
          )}
        </section>

        {/* Modo discreto global */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4">
          <SectionTitle icon={<EyeOff className="w-3.5 h-3.5" />}>Modo discreto</SectionTitle>
          <div className="space-y-1.5">
            <Segmented label="Modo discreto" value={settings.discreetMode} options={DISCREET_OPTIONS} onChange={(discreetMode) => updateSettings({ discreetMode })} />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Oculta os nomes (e descrições) de todos os hábitos, nas telas e nos avisos. O botão de olho no topo alterna na hora, até você recarregar o app.
            </p>
          </div>
          {settings.discreetMode === 'auto' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="discreet-from" className="text-xs font-medium">Das</label>
                <input
                  id="discreet-from"
                  type="time"
                  value={settings.discreetFrom}
                  onChange={(e) => isValidTime(e.target.value) && updateSettings({ discreetFrom: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="discreet-to" className="text-xs font-medium">Até</label>
                <input
                  id="discreet-to"
                  type="time"
                  value={settings.discreetTo}
                  onChange={(e) => isValidTime(e.target.value) && updateSettings({ discreetTo: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono"
                />
              </div>
              <p className="col-span-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                A janela pode passar da meia-noite (ex.: 22:00 até 07:00). É reavaliada a cada 30 s e quando você volta ao app.
              </p>
            </div>
          )}
        </section>

        {/* Aparência */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4">
          <SectionTitle icon={<LayoutGrid className="w-3.5 h-3.5" />}>Aparência</SectionTitle>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Layout dos hábitos no Foco</p>
            <Segmented label="Layout dos hábitos no Foco" value={settings.focusLayout} options={LAYOUT_OPTIONS} onChange={(focusLayout) => updateSettings({ focusLayout })} />
            <div aria-hidden="true" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">Prévia</p>
              <div className="grid grid-cols-2 gap-1.5">
                {settings.focusLayout === 'gallery' ? (
                  <>
                    {[0, 1].map((n) => (
                      <div key={n} className="rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
                        <div className="h-9 bg-zinc-300 dark:bg-zinc-700" />
                        <div className="h-4 bg-zinc-50 dark:bg-zinc-900" />
                      </div>
                    ))}
                  </>
                ) : settings.focusLayout === 'bento' ? (
                  <>
                    <div className="col-span-2 h-10 rounded-lg border border-zinc-500 bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-8 rounded-lg border border-zinc-300 dark:border-zinc-700" />
                    <div className="h-8 rounded-lg border border-zinc-300 dark:border-zinc-700" />
                  </>
                ) : (
                  <>
                    {[0, 1, 2].map((n) => (
                      <div key={n} className="col-span-2 h-6 rounded-lg border border-zinc-300 dark:border-zinc-700 flex items-center gap-1.5 px-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm border border-zinc-400" />
                        <span className="h-1.5 w-1/3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Hábitos destacados (até 2, ao editar um hábito) ficam fixados no topo; no Bento e em Capas ocupam a largura toda. Em Capas, cada hábito vira um cartão com a imagem em destaque.
            </p>
          </div>
        </section>

        {/* Acessibilidade */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4">
          <SectionTitle icon={<Accessibility className="w-3.5 h-3.5" />}>Acessibilidade</SectionTitle>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Tamanho do texto</p>
            <Segmented label="Tamanho do texto" value={settings.textSize} options={TEXT_OPTIONS} onChange={(textSize) => updateSettings({ textSize })} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Animações</p>
            <Segmented label="Animações" value={settings.motion} options={MOTION_OPTIONS} onChange={(motion) => updateSettings({ motion })} />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              “Sistema” segue a preferência de movimento reduzido do seu aparelho.
            </p>
          </div>
          <Switch
            label="Alto contraste"
            description="Reforça textos secundários e bordas."
            checked={settings.highContrast}
            onChange={(highContrast) => updateSettings({ highContrast })}
          />
        </section>

        {/* Ofensiva */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4">
          <SectionTitle icon={<Flame className="w-3.5 h-3.5" />}>Ofensiva</SectionTitle>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Dias de graça por hábito, por mês</p>
            <Segmented
              label="Dias de graça por mês"
              value={String(settings.graceDaysPerMonth) as '0' | '1' | '2'}
              options={GRACE_OPTIONS}
              onChange={(value) => updateSettings({ graceDaysPerMonth: Number(value) as 0 | 1 | 2 })}
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Um dia de graça perdoa um dia perdido (dos últimos 7) sem quebrar a ofensiva. Ele não conta como
              concluído nem soma à ofensiva, e a cota é por hábito, em cada mês.
            </p>
          </div>
        </section>

        {/* Notificações */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4">
          <SectionTitle icon={<Bell className="w-3.5 h-3.5" />}>Notificações</SectionTitle>

          <div className="divide-y divide-zinc-200/70 dark:divide-zinc-800">
          <Switch
            label="Lembrete diário"
            description="Avisa quantos hábitos ainda faltam hoje, sem mostrar os nomes."
            checked={settings.reminderEnabled}
            onChange={toggleReminder}
          />
          {settings.reminderEnabled && (
            <div className="flex items-center justify-between gap-4 pb-1">
              <label htmlFor="reminder-time" className="text-xs font-medium">Horário do lembrete</label>
              <input
                id="reminder-time"
                type="time"
                value={settings.reminderTime}
                onChange={(e) => isValidTime(e.target.value) && updateSettings({ reminderTime: e.target.value })}
                className="min-h-[44px] px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono"
              />
            </div>
          )}
          {settings.reminderEnabled && (
            <Switch
              label="Resumo semanal no domingo"
              description="Acrescenta ao lembrete de domingo a taxa da semana. Sem nomes de hábitos."
              checked={settings.weeklySummaryInReminder}
              onChange={(weeklySummaryInReminder) => updateSettings({ weeklySummaryInReminder })}
            />
          )}
          <Switch
            label="Aviso de fim do Pomo"
            description="Notificação do sistema quando o app estiver em segundo plano."
            checked={settings.pomoAlerts}
            onChange={togglePomoAlerts}
          />
          <Switch label="Som ao concluir" checked={settings.sound} onChange={(sound) => updateSettings({ sound })} />
          <Switch label="Vibração ao concluir" checked={settings.vibration} onChange={(vibration) => updateSettings({ vibration })} />
          </div>

          {Capacitor.isNativePlatform() && !exactAlarmGranted && (
            <div className="flex items-center justify-between gap-3 py-2 border-t border-zinc-200/70 dark:border-zinc-800/80">
              <div className="min-w-0">
                <p className="text-xs font-medium">Alarmes exatos (Pomo pontual)</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Permite disparar o fim do Pomo no segundo exato com o app fechado.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const ok = await openNativeExactAlarmSetting();
                  setExactAlarmGranted(ok);
                }}
                className="min-h-[36px] px-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-medium shrink-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Permitir
              </button>
            </div>
          )}

          <details className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3">
            <summary className="min-h-[44px] flex items-center justify-between cursor-pointer text-xs font-medium list-none [&::-webkit-details-marker]:hidden">
              Como funcionam os lembretes
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-2 pb-3">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {permission === 'denied'
              ? 'As notificações estão bloqueadas. Libere nas configurações do sistema/navegador para receber avisos.'
              : permission === 'unsupported'
              ? 'Este navegador não suporta notificações do sistema.'
              : Capacitor.isNativePlatform()
              ? 'No app Android, os lembretes dos próximos 7 dias e o fim do Pomo são agendados no sistema e funcionam mesmo com o app fechado.'
              : 'Na web, os lembretes funcionam com o app aberto ou instalado e ativo em segundo plano (no app Android, funcionam mesmo fechado). No iPhone, instale o app na tela de início.'}
          </p>
          {permission !== 'unsupported' && !Capacitor.isNativePlatform() && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Não usamos servidor de push: na web, se o navegador encerrar o app, o lembrete não é enviado. Quando
              falta apenas 1 hábito, a notificação traz o botão "Marcar como feito" (no navegador Android; o iPhone não
              mostra botões). O hábito é marcado assim que o app abrir, se ele não estiver aberto.
            </p>
          )}
            </div>
          </details>
          {permission !== 'unsupported' && (
            <button type="button" onClick={sendTest} className={`${BTN} w-full`}>
              <Bell className="w-3.5 h-3.5" />
              Enviar notificação de teste
            </button>
          )}
        </section>

        {/* Privacidade: bloqueio do app */}
        <LockSettings />

        {/* Dados e privacidade */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4">
          <SectionTitle icon={<ShieldCheck className="w-3.5 h-3.5" />}>Dados e privacidade</SectionTitle>

          <button type="button" onClick={() => setView('privacy')} className={`${BTN} w-full`}>
            <FileText className="w-3.5 h-3.5" />
            Política de Privacidade
          </button>
          <button type="button" onClick={exportData} className={`${BTN} w-full`}>
            <Download className="w-3.5 h-3.5" />
            Exportar meus dados (JSON)
          </button>

          {confirm === null && (
            <>
              <button type="button" onClick={() => setConfirm('device')} className={`${BTN} w-full`}>
                <Trash2 className="w-3.5 h-3.5" />
                Apagar dados deste dispositivo
              </button>
              {isFirebaseConfigured && user && (
                <button type="button" onClick={() => setConfirm('account')} className={`${BTN} w-full`}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir conta e dados na nuvem
                </button>
              )}
            </>
          )}

          {confirm && (
            <div role="alertdialog" aria-labelledby="confirm-text" className="p-4 rounded-2xl border border-zinc-950 dark:border-zinc-50 space-y-3">
              <p id="confirm-text" className="text-xs leading-relaxed">
                {confirm === 'device'
                  ? 'Isso apaga hábitos, check-ins e sessões do Pomo salvos neste navegador. Dados já sincronizados com a nuvem não são afetados e voltarão ao entrar na conta.'
                  : 'Isso exclui permanentemente sua conta e todos os hábitos, check-ins e sessões na nuvem, além dos dados deste dispositivo. Não pode ser desfeito.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => setConfirm(null)} className={BTN}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirm === 'device' ? clearDeviceData : runDeleteAccount}
                  className={`${BTN_PRIMARY} disabled:opacity-50`}
                >
                  {busy ? 'Excluindo…' : confirm === 'device' ? 'Apagar' : 'Excluir tudo'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </ModalShell>
  );
};
