import React, { useEffect, useState } from 'react';
import { User as UserIcon } from 'lucide-react';

interface AvatarProps {
  photoURL?: string | null;
  name?: string | null;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ photoURL, name, className = 'w-9 h-9' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [photoURL]);

  const initial = name?.trim().charAt(0).toUpperCase();

  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 ${className}`}
    >
      {photoURL && !failed ? (
        <img
          src={photoURL}
          alt={name ? `Foto de ${name}` : 'Foto de perfil'}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : initial ? (
        <span className="font-mono text-sm font-semibold">{initial}</span>
      ) : (
        <UserIcon className="w-1/2 h-1/2" />
      )}
    </div>
  );
};
