import React from 'react';
import {
  Target,
  BookOpen,
  Dumbbell,
  Droplets,
  Brain,
  Zap,
  Code,
  PenTool,
  Coffee,
  Heart,
  Clock,
  Briefcase,
  Music,
  Feather,
  Activity,
  Award,
  type LucideIcon
} from 'lucide-react';

export interface IconDefinition {
  key: string;
  label: string;
  Icon: LucideIcon;
}

export const HABIT_ICONS: IconDefinition[] = [
  { key: 'target', label: 'Foco', Icon: Target },
  { key: 'book', label: 'Leitura', Icon: BookOpen },
  { key: 'dumbbell', label: 'Treino', Icon: Dumbbell },
  { key: 'droplets', label: 'Água', Icon: Droplets },
  { key: 'brain', label: 'Mente', Icon: Brain },
  { key: 'zap', label: 'Energia', Icon: Zap },
  { key: 'code', label: 'Código', Icon: Code },
  { key: 'pen', label: 'Escrita', Icon: PenTool },
  { key: 'coffee', label: 'Rotina', Icon: Coffee },
  { key: 'heart', label: 'Saúde', Icon: Heart },
  { key: 'clock', label: 'Tempo', Icon: Clock },
  { key: 'briefcase', label: 'Trabalho', Icon: Briefcase },
  { key: 'music', label: 'Música', Icon: Music },
  { key: 'feather', label: 'Leveza', Icon: Feather },
  { key: 'activity', label: 'Movimento', Icon: Activity },
  { key: 'award', label: 'Meta', Icon: Award }
];

interface HabitIconProps {
  iconKey: string;
  className?: string;
}

export const HabitIcon: React.FC<HabitIconProps> = ({ iconKey, className = 'w-4 h-4' }) => {
  const found = HABIT_ICONS.find((item) => item.key === iconKey);
  const IconComponent = found ? found.Icon : Target;
  return <IconComponent className={className} />;
};
