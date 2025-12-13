import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Save } from 'lucide-react';
import { supabase, Category, Lecture } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PomodoroTimerProps {
  onSessionComplete: () => void;
  darkMode?: boolean;
  categoriesVersion?: number;
  lecturesVersion?: number;
  startLectureData?: { lectureId: string; subjectName: string } | null;
  onLectureStarted?: () => void;
}

type StoredTimerState = {
  version: 1;
  isRunning: boolean;
  endAt: number | null; // epoch ms
  remainingMs: number; // when paused
  initialMinutes: number;
  sessionName: string;
  category: string;
  selectedLectureId: string | 'none';
  finished: boolean;
  autoSaved: boolean;
  updatedAt: number; // epoch ms
};

const STORAGE_VERSION = 1;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function msToMinSec(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000)); // ceil so it doesn't show 00:00 too early
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return { m, s };
}

export function PomodoroTimer({
  onSessionComplete,
  darkMode = false,
  categoriesVersion = 0,
  lecturesVersion = 0,
  startLectureData,
  onLectureStarted,
}: PomodoroTimerProps) {
  const { user } = useAuth();

  // Core timer state (timestamp-based)
  const [initialMinutes, setInitialMinutes] = useState(25);
  const [remainingMs, setRemainingMs] = useState(25 * 60 * 1000);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // UI fields
  const [sessionName, setSessionName] = useState('');
  const [category, setCategory] = useState('General'); // subject
  const [categories, setCategories] = useState<Category[]>([]);

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedLectureId, setSelectedLectureId] = useState<string | 'none'>('none');

  const [isSaving, setIsSaving] = useState(false);

  // Refs
  const endAtRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoSavedRef = useRef(false);

  const storageKey = user ? `pomodoro_state_${user.id}` : null;

  // ---------- Persistence helpers ----------
  const writeStorage = (partial?: Partial<StoredTimerState>) => {
    if (!storageKey) return;

    const base: StoredTimerState = {
      version: STORAGE_VERSION,
      isRunning,
      endAt: endAtRef.current,
      remainingMs,
      initialMinutes,
      sessionName,
      category,
      selectedLectureId,
      finished: isFinished,
      autoSaved: autoSavedRef.current,
      updatedAt: Date.now(),
    };

    const data: StoredTimerState = { ...base, ...(partial ?? {}), updatedAt: Date.now() };

    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // ignore storage failures
    }
  };

  const clearStorage = () => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  const readStorage = (): StoredTimerState | null => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredTimerState;
      if (!parsed || parsed.version !== STORAGE_VERSION) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  // ---------- Load categories ----------
  useEffect(() => {
    const loadCategories = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setCategories(data);
      }
    };

    loadCategories();
  }, [user, categoriesVersion]);

  // ---------- Load lectures for current user + subject ----------
  useEffect(() => {
    const loadLectures = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('lectures')
        .select('*')
        .eq('user_id', user.id)
        .eq('subject_name', category)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setLectures(data);
      } else {
        setLectures([]);
      }

      setSelectedLectureId('none');
    };

    if (category) loadLectures();
  }, [user, category, lecturesVersion]);

  // ---------- Start lecture shortcut ----------
  useEffect(() => {
    if (startLectureData) {
      setCategory(startLectureData.subjectName);
      setSelectedLectureId(startLectureData.lectureId);
      onLectureStarted?.();
    }
  }, [startLectureData, onLectureStarted]);

  // ---------- Restore timer from localStorage on mount/auth ----------
  useEffect(() => {
    if (!user) return;

    const stored = readStorage();
    if (!stored) {
      // initialize clean
      endAtRef.current = null;
      autoSavedRef.current = false;
      setIsRunning(false);
      setIsFinished(false);
      setInitialMinutes(25);
      setRemainingMs(25 * 60 * 1000);
      setSessionName('');
      setCategory('General');
      setSelectedLectureId('none');
      return;
    }

    autoSavedRef.current = stored.autoSaved;

    setInitialMinutes(clamp(stored.initialMinutes, 1, 999));
    setSessionName(stored.sessionName ?? '');
    setCategory((stored.category || 'General').trim() || 'General');
    setSelectedLectureId(stored.selectedLectureId ?? 'none');
    setIsFinished(!!stored.finished);

    if (stored.isRunning && stored.endAt) {
      endAtRef.current = stored.endAt;
      const msLeft = stored.endAt - Date.now();

      if (msLeft <= 0) {
        // Timer should already be finished — finalize immediately (and autosave if not done)
        endAtRef.current = null;
        setRemainingMs(0);
        setIsRunning(false);
        finalizeFinish(true); // "fromRestore" true
      } else {
        setRemainingMs(msLeft);
        setIsRunning(true);
      }
    } else {
      endAtRef.current = null;
      setRemainingMs(Math.max(0, stored.remainingMs ?? 0));
      setIsRunning(false);

      // If it was marked finished but not autosaved for some reason, finalize
      if (stored.finished && !stored.autoSaved) {
        finalizeFinish(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ---------- Tick engine ----------
  useEffect(() => {
    const stopTick = () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };

    if (!isRunning) {
      stopTick();
      writeStorage({ isRunning: false, endAt: endAtRef.current, remainingMs });
      return;
    }

    // Running: ensure we have endAt
    if (!endAtRef.current) {
      endAtRef.current = Date.now() + remainingMs;
      writeStorage({ isRunning: true, endAt: endAtRef.current });
    }

    stopTick();
    tickRef.current = window.setInterval(() => {
      const endAt = endAtRef.current;
      if (!endAt) return;

      const msLeft = endAt - Date.now();
      if (msLeft <= 0) {
        setRemainingMs(0);
        setIsRunning(false);
        endAtRef.current = null;
        finalizeFinish(false);
        return;
      }

      setRemainingMs(msLeft);
    }, 250);

    return stopTick;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  // Keep storage in sync for important fields even while paused
  useEffect(() => {
    writeStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, initialMinutes, sessionName, category, selectedLectureId, isFinished]);

  // Recalculate immediately when returning to tab
  useEffect(() => {
    const onVis = () => {
      if (!isRunning) return;
      const endAt = endAtRef.current;
      if (!endAt) return;

      const msLeft = endAt - Date.now();
      if (msLeft <= 0) {
        setRemainingMs(0);
        setIsRunning(false);
        endAtRef.current = null;
        finalizeFinish(false);
      } else {
        setRemainingMs(msLeft);
      }
    };

    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  // ---------- Finish handler (sound + autosave) ----------
  const finalizeFinish = (fromRestore: boolean) => {
    // Mark finished UI
    setIsFinished(true);
    writeStorage({ finished: true, isRunning: false, endAt: null, remainingMs: 0 });

    // Attempt to play sound (may fail due to autoplay restrictions)
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }

    // Auto-save once (even if sound is blocked)
    if (!autoSavedRef.current) {
      autoSavedRef.current = true;
      writeStorage({ autoSaved: true });

      // If it was restored after endAt passed, we still want to save.
      void autoSaveAtFinish(fromRestore);
    }
  };

  const autoSaveAtFinish = async (_fromRestore: boolean) => {
    if (!user) return;

    // If user never actually started or duration invalid, don’t save
    if (initialMinutes <= 0) return;

    // Avoid concurrent saves
    if (isSaving) return;
    setIsSaving(true);

    const lectureIdToSave =
      selectedLectureId && selectedLectureId !== 'none' ? selectedLectureId : null;

    const { error } = await supabase.from('timer_sessions').insert({
      user_id: user.id,
      name: sessionName || 'Pomodoro Session',
      duration_minutes: initialMinutes, // full session completed
      completed_at: new Date().toISOString(),
      category: (category || 'General').trim() || 'General',
      lecture_id: lectureIdToSave,
    });

    if (!error) {
      onSessionComplete();
      // keep finished UI; user can reset manually, but we also can clear stored state now
      // to prevent any weird re-save after reload:
      writeStorage({ autoSaved: true, finished: true });
    } else {
      // If save fails, allow retry by clicking save manually
      autoSavedRef.current = false;
      writeStorage({ autoSaved: false });
      alert('Auto-save failed: ' + error.message);
    }

    setIsSaving(false);
  };

  // ---------- Controls ----------
  const handleStart = () => {
    if (remainingMs <= 0) return;

    // If starting fresh (not finished), reset autosave flag
    if (!isRunning) {
      autoSavedRef.current = false;
      setIsFinished(false);
    }

    // Set endAt if missing
    if (!endAtRef.current) {
      endAtRef.current = Date.now() + remainingMs;
    }

    setIsRunning(true);
    writeStorage({ isRunning: true, endAt: endAtRef.current, finished: false, autoSaved: autoSavedRef.current });
  };

  const handlePause = () => {
    if (!isRunning) return;

    const endAt = endAtRef.current;
    const msLeft = endAt ? Math.max(0, endAt - Date.now()) : remainingMs;

    endAtRef.current = null;
    setRemainingMs(msLeft);
    setIsRunning(false);

    writeStorage({ isRunning: false, endAt: null, remainingMs: msLeft });
  };

  const handleReset = () => {
    // Stop everything
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    endAtRef.current = null;

    setIsRunning(false);
    setRemainingMs(initialMinutes * 60 * 1000);
    setIsFinished(false);
    autoSavedRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Keep basic form fields but reset timer state. If you want to clear them too, tell me.
    writeStorage({
      isRunning: false,
      endAt: null,
      remainingMs: initialMinutes * 60 * 1000,
      finished: false,
      autoSaved: false,
    });
  };

  const handleDurationChange = (newMinutes: number) => {
    if (isRunning) return;

    const safe = clamp(newMinutes, 1, 999);
    setInitialMinutes(safe);
    setRemainingMs(safe * 60 * 1000);
    setIsFinished(false);
    autoSavedRef.current = false;

    writeStorage({
      initialMinutes: safe,
      remainingMs: safe * 60 * 1000,
      finished: false,
      autoSaved: false,
      isRunning: false,
      endAt: null,
    });
  };

  const handleSaveManual = async () => {
    if (!user) return;

    // If finished, it should already have been autosaved. Avoid double-save.
    if (autoSavedRef.current) {
      alert('This session was already saved.');
      return;
    }

    const elapsedMs = initialMinutes * 60 * 1000 - remainingMs;
    if (elapsedMs < 60 * 1000) {
      alert('Session too short to save!');
      return;
    }

    const totalMinutes = Math.ceil(elapsedMs / 60000);

    setIsSaving(true);

    const lectureIdToSave =
      selectedLectureId && selectedLectureId !== 'none' ? selectedLectureId : null;

    const { error } = await supabase.from('timer_sessions').insert({
      user_id: user.id,
      name: sessionName || 'Pomodoro Session',
      duration_minutes: totalMinutes,
      completed_at: new Date().toISOString(),
      category: (category || 'General').trim() || 'General',
      lecture_id: lectureIdToSave,
    });

    if (error) {
      alert('Failed to save session: ' + error.message);
    } else {
      onSessionComplete();
      setSessionName('');
      // After manual save, reset timer:
      autoSavedRef.current = true;
      writeStorage({ autoSaved: true });
      handleReset();
    }

    setIsSaving(false);
  };

  // ---------- UI computed ----------
  const { m: minutes, s: seconds } = msToMinSec(remainingMs);

  const progress =
    initialMinutes > 0
      ? ((initialMinutes * 60 * 1000 - remainingMs) / (initialMinutes * 60 * 1000)) * 100
      : 0;

  const categoryColor =
    categories.find((c) => c.name === category)?.color || '#3b82f6';

  const lecturesForSelect = lectures;

  return (
    <div className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-xl p-8 w-full max-w-md`}>
      <audio ref={audioRef} src="/timer-finished.mp3" preload="auto" />

      {/* Session name */}
      <div className="mb-6">
        <label
          htmlFor="sessionName"
          className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}
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
            darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'border-gray-300'
          }`}
        />
      </div>

      {/* Subject */}
      <div className="mb-4">
        <label
          htmlFor="category"
          className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}
        >
          Subject
        </label>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-4 h-4 rounded-full border border-gray-300"
            style={{ backgroundColor: categoryColor }}
          />
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
            }`}
          >
            <option value="General">General</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lecture select */}
      <div className="mb-6">
        <label
          htmlFor="lecture"
          className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}
        >
          Lecture (optional)
        </label>
        <select
          id="lecture"
          value={selectedLectureId}
          onChange={(e) => setSelectedLectureId(e.target.value === 'none' ? 'none' : e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'
          }`}
        >
          <option value="none">No lecture selected</option>
          {lecturesForSelect.map((lecture) => (
            <option key={lecture.id} value={lecture.id}>
              {lecture.title}
            </option>
          ))}
        </select>
      </div>

      {/* Duration */}
      <div className="mb-6">
        <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
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
                const value = parseInt(e.target.value, 10);
                handleDurationChange(Number.isFinite(value) ? value : 1);
              }}
              disabled={isRunning}
              placeholder="Custom"
              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'border-gray-300'
              }`}
            />
            <button
              onClick={() => handleDurationChange(initialMinutes)}
              disabled={isRunning}
              className={`px-3 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                darkMode ? 'bg-slate-700 hover:bg-slate-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Set
            </button>
          </div>
        </div>
      </div>

      {/* Circle timer */}
      <div className="relative mb-8">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" stroke={darkMode ? '#475569' : '#e5e7eb'} strokeWidth="12" fill="none" />
          <circle
            cx="100"
            cy="100"
            r="90"
            stroke={isFinished ? '#ef4444' : '#3b82f6'}
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 90}`}
            strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
            strokeLinecap="round"
            className={`transition-all duration-200 ${isFinished ? 'animate-pulse' : ''}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`text-center ${isFinished ? 'animate-pulse' : ''}`}>
            <div
              className={`text-5xl font-bold ${
                isFinished ? 'text-red-500' : darkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={remainingMs <= 0}
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
          onClick={handleSaveManual}
          disabled={isSaving || remainingMs === initialMinutes * 60 * 1000 || autoSavedRef.current}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          title={autoSavedRef.current ? 'Already saved (auto)' : 'Save session'}
        >
          <Save className="w-5 h-5" />
        </button>
      </div>

      <p className={`text-xs text-center mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        Auto-save happens at 00:00. Manual save is for partial sessions.
      </p>
    </div>
  );
}
