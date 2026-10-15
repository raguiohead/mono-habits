import React from 'react';
import { X, Cloud, UserCheck, LogOut, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Avatar } from './Avatar';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const { user, loginWithGoogle, logout } = useHabits();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <Cloud className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Sincronização & Conta Google</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Gestão de persistência em nuvem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl opacity-60 hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Perfil */}
        {user && (user.photoURL || user.displayName || user.email) && (
          <div className="flex items-center gap-3">
            <Avatar photoURL={user.photoURL} name={user.displayName || user.email} className="w-12 h-12" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user.displayName || 'Conta Google'}</p>
              {user.email && (
                <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
              )}
            </div>
          </div>
        )}

        {/* Status de Conexão */}
        <div className="space-y-3 text-xs">
          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 font-mono space-y-2">
            <div className="flex items-center justify-between">
              <span className="opacity-60 text-[11px]">STATUS:</span>
              <span className="font-semibold flex items-center gap-1.5">
                {user ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                    CONECTADO COM GOOGLE
                  </>
                ) : isFirebaseConfigured ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
                    MODO NUVEM ANÔNIMA
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-zinc-400" />
                    MODO LOCAL OFFLINE
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
              <span className="opacity-60 text-[11px]">USUÁRIO:</span>
              <span className="truncate max-w-[220px]">
                {user ? (user.email || user.displayName || user.uid) : 'Armazenamento Local'}
              </span>
            </div>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {user
              ? 'Seus hábitos, metas e check-ins diários estão sincronizados em tempo real com seu Cloud Firestore seguro.'
              : isFirebaseConfigured
              ? 'Vincule sua Conta Google para acessar seus hábitos de qualquer dispositivo e garantir backup permanente.'
              : 'Você está no modo Local-First. Todos os seus dados são salvos instantaneamente no armazenamento do seu navegador.'}
          </p>

          {/* Dica de Segurança / Configuração */}
          <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 text-zinc-500 mt-0.5" />
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
              <strong>Privacidade Monocromática:</strong> Seus dados pertencem exclusivamente a você e são protegidos por regras rigorosas do Firestore baseadas no seu ID.
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 space-y-2">
            {user ? (
              <button
                type="button"
                onClick={logout}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Desconectar da Conta</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={loginWithGoogle}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <UserCheck className="w-4 h-4" />
                <span>Conectar com Google</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
