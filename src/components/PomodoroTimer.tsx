import { useState, useEffect, useRef, FormEvent } from 'react';
import { Play, Pause, RotateCcw, Save, Plus } from 'lucide-react';
import { supabase, Category } from '../lib/supabase';
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
  const [isFinished, setIsFinished] = useState(false);

  // Catégories
  const [category, setCategory] = useState('General');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Rename
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();

  // Charger les catégories de l'utilisateur
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
  }, [user]);

  // Timer
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setSeconds((prevSeconds) => {
          if (prevSeconds === 0) {
            setMinutes((prevMinutes) => {
              if (prevMinutes === 0) {
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

  // Détection de fin : 00:00
  useEffect(() => {
    if (minutes === 0 && seconds === 0 && initialMinutes > 0 && !isFinished) {
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setIsFinished(true);

      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current
          .play()
          .catch(() => {
            // navigateur peut bloquer l'auto-play, on ignore
          });
      }
    }
  }, [minutes, seconds, initialMinutes, isFinished]);

  const handleStart = () => {
    if (minutes === 0 && seconds === 0) return;
    if (!isRunning && minutes === initialMinutes && seconds === 0) {
      setInitialMinutes(minutes);
    }
    setIsFinished(false);
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setMinutes(initialMinutes);
    setSeconds(0);
    setIsFinished(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleDurationChange = (newMinutes: number) => {
    if (!isRunning) {
      setMinutes(newMinutes);
      setInitialMinutes(newMinutes);
      setSeconds(0);
      setIsFinished(false);
    }
  };

  // Ajout d'une catégorie
  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const name = newCategoryName.trim();
    if (!name) {
      setCategoryMessage('Category name is required.');
      return;
    }

    setCategoryLoading(true);
    setCategoryMessage(null);

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name,
        color: newCategoryColor || '#3b82f6',
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting category', error);
      if (error.message.includes('categories_user_id_name_idx')) {
        setCategoryMessage('This category already exists.');
      } else {
        setCategoryMessage(`Failed to add category: ${error.message}`);
      }
    } else if (data) {
      setCategories((prev) => [...prev, data]);
      setCategory(data.name);
      setNewCategoryName('');
      setCategoryMessage('Category added.');
    }

    setCategoryLoading(false);
  };

  // Démarrer le rename
  const startEditingCategory = (name: string) => {
    setEditingCategory(name);
    setEditingCategoryName(name);
    setCategoryMessage(null);
  };

  // Valider le rename
  const handleRenameCategory = async (e: FormEvent, oldName: string) => {
    e.preventDefault();
    if (!user) return;

    const newName = editingCategoryName.trim();
    if (!newName) {
      setCategoryMessage('Category name is required.');
      return;
    }

    if (newName === oldName) {
      setEditingCategory(null);
      return;
    }

    setCategoryLoading(true);
    setCategoryMessage(null);

    // Update dans la table categories
    const { error: catError } = await supabase
      .from('categories')
      .update({ name: newName })
      .eq('user_id', user.id)
      .eq('name', oldName);

    if (catError) {
      console.error('Error renaming category', catError);
      if (catError.message.includes('categories_user_id_name_idx')) {
        setCategoryMessage('A category with this name already exists.');
      } else {
        setCategoryMessage('Failed to rename category.');
      }
      setCategoryLoading(false);
      return;
    }

    // Mettre à jour toutes les sessions avec l'ancien nom
    const { error: sessError } = await supabase
      .from('timer_sessions')
      .update({ category: newName })
      .eq('user_id', user.id)
      .eq('category', oldName);

    if (sessError) {
      console.error('Error updating sessions category', sessError);
      setCategoryMessage('Category renamed, but failed to update some sessions.');
    } else {
      setCategoryMessage('Category renamed.');
    }

    // Sync local
    setCategories((prev) =>
      prev.map((c) => (c.name === oldName ? { ...c, name: newName } : c))
    );
    if (category === oldName) {
      setCategory(newName);
    }

    setEditingCategory(null);
    setCategoryLoading(false);
  };

  // Suppression d'une catégorie : on remet les sessions sur "General"
  const handleDeleteCategory = async (name: string) => {
    if (!user) return;

    if (!confirm(`Delete category "${name}"? Sessions using it will be set to "General".`)) {
      return;
    }

    setCategoryLoading(true);
    setCategoryMessage(null);

    // Mettre à jour les sessions
    const { error: sessError } = await supabase
      .from('timer_sessions')
      .update({ category: 'General' })
      .eq('user_id', user.id)
      .eq('category', name);

    if (sessError) {
      console.error('Error updating sessions for deleted category', sessError);
      setCategoryMessage('Failed to update sessions for this category.');
      setCategoryLoading(false);
      return;
    }

    // Supprimer la catégorie
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('user_id', user.id)
      .eq('name', name);

    if (deleteError) {
      console.error('Error deleting category', deleteError);
      setCategoryMessage('Failed to delete category.');
    } else {
      setCategories((prev) => prev.filter((c) => c.name !== name));
      if (category === name) {
        setCategory('General');
      }
      setCategoryMessage('Category deleted.');
    }

    setCategoryLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    // Temps écoulé en secondes
    const totalSeconds = initialMinutes * 60 - (minutes * 60 + seconds);

    if (totalSeconds < 60) {
      alert('Session too short to save!');
      return;
    }

    const totalMinutes = Math.ceil(totalSeconds / 60);

    setIsSaving(true);

    const { error } = await supabase.from('timer_sessions').insert({
      user_id: user.id,
      name: sessionName || 'Pomodoro Session',
      duration_minutes: totalMinutes,
      completed_at: new Date().toISOString(),
      category: (category || 'General').trim(),
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

  const progress =
    initialMinutes > 0
      ? ((initialMinutes * 60 - (minutes * 60 + seconds)) /
          (initialMinutes * 60)) *
        100
      : 0;

  const categoryColor =
    categories.find((c) => c.name === category)?.color || '#3b82f6';

  return (
    <div
      className={`${
        darkMode ? 'bg-slate-800' : 'bg-white'
      } rounded-2xl shadow-xl p-8 w-full max-w-md`}
    >
      {/* Son de fin */}
      <audio ref={audioRef} src="/timer-finished.mp3" preload="auto" />

      {/* Session name */}
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

      {/* Category */}
      <div className="mb-6 space-y-3">
        <div>
          <label
            htmlFor="category"
            className={`block text-sm font-medium ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            } mb-2`}
          >
            Category
          </label>
          <div className="flex gap-2 items-center">
            <span
              className="inline-block w-4 h-4 rounded-full border border-gray-300"
              style={{ backgroundColor: categoryColor }}
            />
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                darkMode
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'border-gray-300'
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

        {/* Ajouter une catégorie */}
        <form onSubmit={handleAddCategory} className="space-y-2 text-sm">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                darkMode
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                  : 'border-gray-300'
              }`}
            />
            <input
              type="color"
              value={newCategoryColor}
              onChange={(e) => setNewCategoryColor(e.target.value)}
              className="w-12 h-10 rounded cursor-pointer border border-gray-300"
              title="Category color"
            />
            <button
              type="submit"
              disabled={categoryLoading}
              className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </form>

        {/* Liste des catégories avec rename + delete */}
        {categories.length > 0 && (
          <div className="text-xs space-y-1 mt-2 max-h-32 overflow-y-auto">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`flex items-center justify-between px-2 py-1 rounded ${
                  darkMode ? 'bg-slate-700' : 'bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  {editingCategory === cat.name ? (
                    <form
                      onSubmit={(e) => handleRenameCategory(e, cat.name)}
                      className="flex items-center gap-2 min-w-0"
                    >
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className={`px-2 py-1 border rounded text-xs min-w-0 ${
                          darkMode
                            ? 'bg-slate-800 border-slate-600 text-gray-100'
                            : 'bg-white border-gray-300 text-gray-800'
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={categoryLoading}
                        className="text-green-500 hover:text-green-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <span className="truncate">{cat.name}</span>
                  )}
                </div>

                {editingCategory !== cat.name && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditingCategory(cat.name)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.name)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {categoryMessage && (
          <p
            className={`text-xs ${
              categoryMessage.toLowerCase().includes('fail')
                ? 'text-red-500'
                : 'text-gray-500'
            }`}
          >
            {categoryMessage}
          </p>
        )}
      </div>

      {/* Duration */}
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

      {/* Timer cercle + temps */}
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
            stroke={isFinished ? '#ef4444' : '#3b82f6'}
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 90}`}
            strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
            strokeLinecap="round"
            className={`transition-all duration-1000 ${
              isFinished ? 'animate-pulse' : ''
            }`}
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
              {String(minutes).padStart(2, '0')}:
              {String(seconds).padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>

      {/* Boutons */}
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
