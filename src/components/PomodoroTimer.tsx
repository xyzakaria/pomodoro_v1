import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PomodoroTimerProps {
  onSessionComplete: () => void;
  darkMode?: boolean;
}

export function PomodoroTimer({ onSessionComplete, darkMode = false }: PomodoroTimerProps) {
  const [sessionName, setSessionName] = useState('');
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [initialMinutes, setInitialMinutes] = useState(25);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinished, setIsFinished] = useState(false); // 👈 nouvel état
  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null); // 👈 ref son
  const { user } = useAuth();

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setSeconds((prevSeconds) => {
          if (prevSeconds === 0) {
            setMinutes((prevMinutes) => {
              if (prevMinutes === 0) {
                // On laisse la détection de fin au useEffect ci-dessous
                return 0;
              }
              return prevMinutes - 1;
            });
            return 59;
          }
          return prevSeconds - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // 🔔 Détection de la fin du timer : 00:00
  useEffect(() => {
    if (minutes === 0 && seconds === 0 && initialMinutes > 0) {
      if (!isFinished) {
        setIsRunning(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setIsFinished(true);

        // Lecture du son
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {
            // Si le navigateur bloque la lecture auto, on ignore
          });
        }
      }
    }
  }, [minutes, seconds, initialMinutes, isFinished]);

  const handleStart = () => {
    if (minutes === 0 && seconds === 0) return;
    if (!isRunning && minutes === initialMinutes && seconds === 0) {
      setInitialMinutes(minutes);
    }
    setIsFinished(false); // 👈 on enlève l’état “fini” quand on relance
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setMinutes(initialMinutes);
    setSeconds(0);
    setIsFinished(false); // 👈 reset du clignotement
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

const handleSave = async () => {
  if (!user) return;

  // Temps total écoulé en secondes
  const totalSeconds = initialMinutes * 60 - (minutes * 60 + seconds);

  // Si vraiment trop court, on refuse (par ex. moins d'une minute)
  if (totalSeconds < 60) {
    alert('Session too short to save!');
    return;
  }

  // Conversion en minutes, arrondi vers le haut
  const totalMinutes = Math.ceil(totalSeconds / 60);

  setIsSaving(true);

  const { error } = await supabase.from('timer_sessions').insert({
    user_id: user.id,
    name: sessionName || 'Pomodoro Session',
    duration_minutes: totalMinutes,
    completed_at: new Date().toISOString(),
  });

  if (error) {
    alert('Failed to save session: ' + error.message);
  } else {
    onSessionComplete();
    setSessionName('');
    handleReset();
  }

  setIsSaving(false);
};


  const handleDurationChange = (newMinutes: number) => {
    if (!isRunning) {
      setMinutes(newMinutes);
      setInitialMinutes(newMinutes);
      setSeconds(0);
      setIsFinished(false);
    }
  };

  const progress = initialMinutes > 0
    ? ((initialMinutes * 60 - (minutes * 60 + seconds)) / (initialMinutes * 60)) * 100
    : 0;

  return (
    <div
      className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-xl p-8 w-full max-w-md`}
    >
      {/* 🔊 Élément audio pour le son de fin */}
      <audio ref={audioRef} src="/timer-finished.mp3" preload="auto" />

      <div className="mb-6">
        <label
          htmlFor="sessionName"
          className={`block text-sm font-medium ${
            darkMode ? 'text-gray-300' : 'text-gray-700'
          } mb-2`}
        >
          Session Name
        </label>
        <input
          id="sessionName"
          type="text"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="What are you working on?"
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            darkMode
              ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
              : 'border-gray-300'
          }`}
        />
      </div>

      <div className="mb-6">
        <label
          className={`block text-sm font-medium ${
            darkMode ? 'text-gray-300' : 'text-gray-700'
          } mb-2`}
        >
          Duration
        </label>
        <div className="space-y-3">
          <div className="flex gap-2">
            {[15, 25, 45, 60].map((min) => (
              <button
                key={min}
                onClick={() => handleDurationChange(min)}
                disabled={isRunning}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors text-sm ${
                  initialMinutes === min && !isRunning
                    ? 'bg-blue-600 text-white'
                    : darkMode
                    ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {min}m
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max="999"
              value={initialMinutes}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                handleDurationChange(Math.max(1, value));
              }}
              disabled={isRunning}
              placeholder="Custom"
              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                darkMode
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                  : 'border-gray-300'
              }`}
            />
            <button
              onClick={() => handleDurationChange(initialMinutes)}
              disabled={isRunning}
              className={`px-3 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                darkMode
                  ? 'bg-slate-700 hover:bg-slate-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Set
            </button>
          </div>
        </div>
      </div>

      <div className="relative mb-8">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r="90"
            stroke={darkMode ? '#475569' : '#e5e7eb'}
            strokeWidth="12"
            fill="none"
          />
          <circle
            cx="100"
            cy="100"
            r="90"
            stroke={isFinished ? '#ef4444' : '#3b82f6'} // 👈 bleu normal, rouge à la fin
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 90}`}
            strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
            strokeLinecap="round"
            className={`transition-all duration-1000 ${
              isFinished ? 'animate-pulse' : ''
            }`} // 👈 clignote
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`text-center ${isFinished ? 'animate-pulse' : ''}`}>
            <div
              className={`text-5xl font-bold ${
                isFinished
                  ? 'text-red-500'
                  : darkMode
                  ? 'text-white'
                  : 'text-gray-900'
              }`}
            >
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={minutes === 0 && seconds === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5" />
            Start
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Pause className="w-5 h-5" />
            Pause
          </button>
        )}

        <button
          onClick={handleReset}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving || (minutes === initialMinutes && seconds === 0)}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
        </button>
      </div>

      <p
        className={`text-xs text-center mt-4 ${
          darkMode ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        Click Save to record your session
      </p>
    </div>
  );
}
