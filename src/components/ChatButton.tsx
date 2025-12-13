import { MessageCircle } from 'lucide-react';

interface ChatButtonProps {
  onClick: () => void;
}

export function ChatButton({ onClick }: ChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full
                 bg-gradient-to-br from-violet-500 to-purple-600
                 shadow-lg hover:shadow-xl hover:scale-105
                 transition-all flex items-center justify-center"
      title="Notes"
    >
      <MessageCircle className="w-6 h-6 text-white" />
    </button>
  );
}
