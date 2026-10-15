import React, { useState } from 'react';
import { HabitsProvider, useHabits } from '@/context/HabitsContext';
import { PomoProvider } from '@/context/PomoContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { Header } from '@/components/Header';
import { DailyFocus } from '@/components/DailyFocus';
import { ConsistencyView } from '@/components/ConsistencyView';
import { PomoView } from '@/components/PomoView';
import { ManageHabits } from '@/components/ManageHabits';
import { HabitModal } from '@/components/HabitModal';
import { SettingsModal } from '@/components/SettingsModal';
import { PrivacyPolicy, PRIVACY_UPDATED_AT } from '@/components/PrivacyPolicy';
import { WelcomeModal } from '@/components/WelcomeModal';
import { getAcceptedPolicyVersion, setAcceptedPolicyVersion } from '@/lib/storage';
import { ReminderScheduler } from '@/components/ReminderScheduler';
import { CompletionQueueSync } from '@/components/CompletionQueueSync';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { BottomNav } from '@/components/BottomNav';
import { Toast } from '@/components/Toast';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { type Habit } from '@/types/habit';

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
            {activeTab === 'stats' && <ConsistencyView />}
            {activeTab === 'pomo' && <PomoView />}
            {activeTab === 'manage' && (
              <ManageHabits
                onOpenCreateModal={handleOpenCreateModal}
                onOpenEditModal={handleOpenEditModal}
                onConfirmDelete={handleConfirmDelete}
              />
            )}
          </main>
        )}
      </div>

      {/* Navegação Inferior (Mobile Thumb Zone) */}
      <BottomNav onOpenCreateModal={handleOpenCreateModal} />

      {/* Notificação Toast */}
      <Toast />

      {/* Modais */}
      <HabitModal
        isOpen={isHabitModalOpen}
        onClose={() => setIsHabitModalOpen(false)}
        onSave={saveHabit}
        initialHabit={editingHabit}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ReminderScheduler />
      <CompletionQueueSync />

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
      <HabitsProvider>
        <PomoProvider>
          <MainContent />
        </PomoProvider>
      </HabitsProvider>
    </SettingsProvider>
  );
}
