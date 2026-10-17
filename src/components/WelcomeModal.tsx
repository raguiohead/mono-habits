import React, { useState } from 'react';
import { ArrowLeft, Calendar, EyeOff, Cloud, Timer } from 'lucide-react';
import { LogoMark } from './LogoMark';
import { ModalShell } from './ModalShell';
import { PrivacyContent } from './PrivacyPolicy';

interface WelcomeModalProps {
  onAccept: () => void;
}

const FEATURES = [
  { icon: Calendar, title: 'Foco diário', text: 'Marque seus hábitos do dia e acompanhe ofensivas e consistência no Grafo.' },
  { icon: Timer, title: 'Pomo', text: 'Um temporizador de foco com pausas, integrado às suas estatísticas.' },
  { icon: EyeOff, title: 'Modo discreto', text: 'Oculte o nome de hábitos sensíveis e mostre só o ícone.' },
  { icon: Cloud, title: 'Local-first', text: 'Tudo funciona no seu aparelho. Conectar o Google é opcional e sincroniza entre dispositivos.' }
];

/** Boas-vindas exibidas na primeira abertura (e quando a política muda). Exige aceite para continuar. */
export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onAccept }) => {
  const [view, setView] = useState<'welcome' | 'privacy'>('welcome');

  // Sem fechar por Esc/fundo: o aceite é uma escolha explícita
  const noop = () => {};

  if (view === 'privacy') {
    return (
      <ModalShell labelledBy="welcome-privacy-title" onClose={noop} widthClass="sm:max-w-lg">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-zinc-200/80 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setView('welcome')}
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Voltar às boas-vindas"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 id="welcome-privacy-title" className="text-sm font-semibold tracking-tight">
            Política de Privacidade
          </h3>
        </div>
        <PrivacyContent />
        <button
          type="button"
          onClick={() => setView('welcome')}
          className="mt-5 w-full min-h-[44px] rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
        >
          Voltar
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell labelledBy="welcome-title" onClose={noop}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <LogoMark className="w-11 h-11" />
          <div>
            <h3 id="welcome-title" className="text-base font-semibold tracking-tight">
              Bem-vindo ao MONO // HABITS
            </h3>
            <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              Consistência diária, sem distrações.
            </p>
          </div>
        </div>

        <ul className="space-y-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <Icon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold">{title}</p>
                <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400 space-y-1.5">
          <p>
            <strong className="text-zinc-950 dark:text-zinc-50">Sua privacidade:</strong> seus hábitos ficam
            salvos neste aparelho. Sem anúncios, sem rastreamento e sem venda de dados. Com a nuvem
            ativa, os dados são sincronizados com o Google Firebase e só você tem acesso.
          </p>
          <p>
            Você pode exportar ou apagar tudo a qualquer momento em Configurações. Notificações são
            opcionais e só pedem permissão quando você as ativa.
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onAccept}
            className="w-full min-h-[44px] rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Aceitar e começar
          </button>
          <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
            Ao continuar, você concorda com a{' '}
            <button
              type="button"
              onClick={() => setView('privacy')}
              className="underline min-h-[44px] px-1 text-zinc-950 dark:text-zinc-50"
            >
              Política de Privacidade
            </button>
            .
          </p>
        </div>
      </div>
    </ModalShell>
  );
};
