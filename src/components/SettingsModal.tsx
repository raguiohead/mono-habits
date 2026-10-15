import React, { useState } from 'react';
import {
  X,
  UserCheck,
  LogOut,
  Cloud,
  CheckCircle2,
  Accessibility,
  Bell,
  ShieldCheck,
  Download,
  Trash2,
  ArrowLeft,
  FileText
} from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { exportLocalData } from '@/lib/storage';
import { getPermission, requestPermission, showSystemNotification } from '@/lib/notifications';
import { isValidTime, type MotionPref, type TextSize } from '@/lib/settings';
import { Avatar } from './Avatar';
import { ModalShell } from './ModalShell';
import { PrivacyContent } from './PrivacyPolicy';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BTN =
  'min-h-[44px] px-4 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2';
const BTN_PRIMARY =
  'min-h-[44px] px-4 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2';

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <h4 className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
    {icon}
    {children}
  </h4>
);

const Switch: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="w-full min-h-[44px] flex items-center justify-between gap-4 py-2 text-left"
  >
    <span>
      <span className="block text-xs font-medium">{label}</span>
      {description && (
        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</span>
      )}
    </span>
    <span
      aria-hidden="true"
      className={`relative shrink-0 w-10 h-6 rounded-full border transition-colors ${
        checked
          ? 'bg-zinc-950 border-zinc-950 dark:bg-zinc-50 dark:border-zinc-50'
          : 'bg-zinc-200 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${
          checked
            ? 'translate-x-4 bg-zinc-50 dark:bg-zinc-950'
            : 'translate-x-0 bg-white dark:bg-zinc-400'
        }`}
      />
    </span>
  </button>
);

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

const TEXT_OPTIONS: { value: TextSize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Grande' },
  { value: 'xlarge', label: 'Muito grande' }
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
  const [view, setView] = useState<'main' | 'privacy'>('main');
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(getPermission());

  if (!isOpen) return null;

  const isGoogle = Boolean(user && !user.isAnonymous);
  const close = () => {
    setView('main');
    setConfirm(null);
    onClose();
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
      <div className="space-y-6">
        {/* Topo */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-zinc-800">
          <div>
            <h3 id="settings-title" className="text-base font-semibold tracking-tight">Configurações</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Conta, acessibilidade e notificações</p>
          </div>
          <button type="button" onClick={close} className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl opacity-70 hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Fechar configurações">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conta */}
        <section className="space-y-3">
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
                'NUVEM ANÔNIMA'
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

        {/* Acessibilidade */}
        <section className="space-y-3">
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

        {/* Notificações */}
        <section className="space-y-2">
          <SectionTitle icon={<Bell className="w-3.5 h-3.5" />}>Notificações</SectionTitle>

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
          <Switch
            label="Aviso de fim do Pomo"
            description="Notificação do sistema quando o app estiver em segundo plano."
            checked={settings.pomoAlerts}
            onChange={togglePomoAlerts}
          />
          <Switch label="Som ao concluir" checked={settings.sound} onChange={(sound) => updateSettings({ sound })} />
          <Switch label="Vibração ao concluir" checked={settings.vibration} onChange={(vibration) => updateSettings({ vibration })} />

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {permission === 'denied'
              ? 'As notificações estão bloqueadas no navegador. Libere nas configurações do site para receber avisos.'
              : permission === 'unsupported'
              ? 'Este navegador não suporta notificações do sistema.'
              : 'Os lembretes funcionam com o app aberto ou instalado e ativo em segundo plano. No iPhone, instale o app na tela de início.'}
          </p>
          {permission !== 'unsupported' && (
            <button type="button" onClick={sendTest} className={`${BTN} w-full`}>
              <Bell className="w-3.5 h-3.5" />
              Enviar notificação de teste
            </button>
          )}
        </section>

        {/* Dados e privacidade */}
        <section className="space-y-3">
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
