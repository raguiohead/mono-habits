import React, { Suspense, lazy, useState } from 'react';
import { HabitsProvider, useHabits } from '@/context/HabitsContext';
import { PomoProvider } from '@/context/PomoContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { LockProvider } from '@/context/LockContext';
import { Header } from '@/components/Header';
import { DailyFocus } from '@/components/DailyFocus';
import { PrivacyPolicy, PRIVACY_UPDATED_AT } from '@/components/PrivacyPolicy';
import { WelcomeModal } from '@/components/WelcomeModal';
import { getAcceptedPolicyVersion, setAcceptedPolicyVersion } from '@/lib/storage';
import { MilestoneWatcher } from '@/components/MilestoneWatcher';
import { DayCompleteEffect } from '@/components/DayCompleteEffect';
import { ReminderScheduler } from '@/components/ReminderScheduler';
import { CompletionQueueSync } from '@/components/CompletionQueueSync';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { BottomNav } from '@/components/BottomNav';
import { Toast } from '@/components/Toast';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { type Habit } from '@/types/habit';

// Telas e modais carregados sob demanda: a primeira abertura baixa só o Foco
const ConsistencyView = lazy(() => import('@/components/ConsistencyView').then((m) => ({ default: m.ConsistencyView })));
const PomoView = lazy(() => import('@/components/PomoView').then((m) => ({ default: m.PomoView })));
const ManageHabits = lazy(() => import('@/components/ManageHabits').then((m) => ({ default: m.ManageHabits })));
const HabitModal = lazy(() => import('@/components/HabitModal').then((m) => ({ default: m.HabitModal })));
const SettingsModal = lazy(() => import('@/components/SettingsModal').then((m) => ({ default: m.SettingsModal })));

const MainContent: React.FC = () => {
  const {
    activeTab,
    saveHabit,
    deleteHabit,
    initialLoaded
  } = useHabits();

  // Estados dos modais
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => getAcceptedPolicyVersion() !== PRIVACY_UPDATED_AT);
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);

  const handleOpenCreateModal = () => {
    setEditingHabit(null);
    setIsHabitModalOpen(true);
  };

  const handleOpenEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setIsHabitModalOpen(true);
  };

  const handleConfirmDelete = (habit: Habit) => {
    setHabitToDelete(habit);
  };

  const executeDelete = async () => {
    if (habitToDelete) {
      await deleteHabit(habitToDelete.id);
      setHabitToDelete(null);
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-200 font-sans selection:bg-zinc-500 selection:text-white bg-[#FAFAFA] dark:bg-[#09090B] text-[#09090B] dark:text-[#FAFAFA]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 md:pb-12 space-y-6">
        {/* Cabeçalho */}
        <Header onOpenSettings={() => setIsSettingsOpen(true)} />

        {/* Conteúdo Principal ou Skeleton */}
        {!initialLoaded ? (
          <SkeletonLoader />
        ) : (
          <main className="transition-opacity duration-200">
            {activeTab === 'today' && (
              <DailyFocus
                onOpenCreateModal={handleOpenCreateModal}
                onOpenEditModal={handleOpenEditModal}
              />
            )}
            <Suspense fallback={<SkeletonLoader />}>
              {activeTab === 'stats' && <ConsistencyView />}
              {activeTab === 'pomo' && <PomoView />}
              {activeTab === 'manage' && (
                <ManageHabits
                  onOpenCreateModal={handleOpenCreateModal}
                  onOpenEditModal={handleOpenEditModal}
                  onConfirmDelete={handleConfirmDelete}
                />
              )}
            </Suspense>
          </main>
        )}
      </div>

      {/* Navegação Inferior (Mobile Thumb Zone) */}
      <BottomNav onOpenCreateModal={handleOpenCreateModal} />

      {/* Notificação Toast */}
      <Toast />

      {/* Modais */}
      <Suspense fallback={null}>
        {isHabitModalOpen && (
          <HabitModal
            isOpen={isHabitModalOpen}
            onClose={() => setIsHabitModalOpen(false)}
            onSave={saveHabit}
            initialHabit={editingHabit}
          />
        )}
        {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}
      </Suspense>

      <ReminderScheduler />
      <CompletionQueueSync />
      <DayCompleteEffect />
      <MilestoneWatcher />

      {showWelcome && (
        <WelcomeModal
          onAccept={() => {
            setAcceptedPolicyVersion(PRIVACY_UPDATED_AT);
            setShowWelcome(false);
          }}
        />
      )}

      <DeleteConfirmModal
        habit={habitToDelete}
        onClose={() => setHabitToDelete(null)}
        onConfirm={executeDelete}
      />
    </div>
  );
};

/** Página pública da política de privacidade (URL exigida por lojas e telas de consentimento do Google) */
const isPrivacyRoute = () => window.location.pathname.replace(/\/+$/, '') === '/privacidade';

export default function App() {
  if (isPrivacyRoute()) {
    return <PrivacyPolicy />;
  }
  return (
    <SettingsProvider>
      {/* O bloqueio fica acima dos dados: bloqueado, nada sensível é montado */}
      <LockProvider>
        <HabitsProvider>
          <PomoProvider>
            <MainContent />
          </PomoProvider>
        </HabitsProvider>
      </LockProvider>
    </SettingsProvider>
  );
}
