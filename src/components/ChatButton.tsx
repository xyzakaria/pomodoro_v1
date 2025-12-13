import { useState } from 'react';
import { Cat } from 'lucide-react';

interface ChatButtonProps {
  onClick: () => void;
}

const MESSAGES = [
  'Good luck 🍀',
  'Focus time.',
  'You got this 💪',
];

export function ChatButton({ onClick }: ChatButtonProps) {
  const [message] = useState(
    MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  );

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
      {/* Message */}
      <div className="bg-white dark:bg-slate-800 text-xs px-3 py-1.5 rounded-full shadow-md text-gray-700 dark:text-gray-200">
        {message}
      </div>

      {/* Chat button */}
      <button
        onClick={onClick}
        className="
          w-14 h-14 rounded-full
          bg-gradient-to-br from-violet-500 to-purple-600
          shadow-xl hover:scale-105
          transition-transform
          flex items-center justify-center
        "
        title="Notes"
      >
        <Cat className="w-7 h-7 text-white" />
      </button>
    </div>
  );
}
