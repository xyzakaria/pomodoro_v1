import { useEffect, useRef, useState } from 'react';
import { Cat } from 'lucide-react';

interface ChatButtonProps {
  onClick: () => void;
}

const MESSAGES = ['Good luck 🍀', 'Meow', 'You got this 💪','bzz bzz'];

export function ChatButton({ onClick }: ChatButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const saved = localStorage.getItem('chatPosition');
    return saved
      ? JSON.parse(saved)
      : { x: window.innerWidth - 90, y: window.innerHeight - 120 };
  });

  const [message] = useState(
    MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  );

  useEffect(() => {
    localStorage.setItem('chatPosition', JSON.stringify(pos));
  }, [pos]);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const stopDrag = () => setDragging(false);

  const onMove = (e: MouseEvent | TouchEvent) => {
    if (!dragging) return;

    const clientX =
      'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY =
      'touches' in e ? e.touches[0].clientY : e.clientY;

    const maxX = window.innerWidth - 70;
    const maxY = window.innerHeight - 90;

    setPos({
      x: Math.min(Math.max(0, clientX - 35), maxX),
      y: Math.min(Math.max(0, clientY - 35), maxY),
    });
  };

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', stopDrag);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', stopDrag);
    };
  });

  return (
    <div
      ref={buttonRef}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[9999] flex flex-col items-end gap-2 select-none"
    >
      {/* Message */}
      <div className="bg-white dark:bg-slate-800 text-xs px-3 py-1.5 rounded-full shadow-md text-gray-700 dark:text-gray-200">
        {message}
      </div>

      {/* Chat */}
      <button
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        onClick={onClick}
        className="
          w-14 h-14 rounded-full
          bg-gradient-to-br from-violet-500 to-purple-600
          shadow-xl hover:scale-105
          transition-transform
          flex items-center justify-center
          cursor-grab active:cursor-grabbing
        "
        title="Drag me"
      >
        <Cat className="w-7 h-7 text-white" />
      </button>
    </div>
  );
}
