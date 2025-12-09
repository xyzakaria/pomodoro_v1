import { useEffect, useState, FormEvent } from 'react';
import { Clock, Calendar, Trash2 } from 'lucide-react';
import { supabase, TimerSession, Category } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SessionHistoryProps {
  refresh: number;
  darkMode?: boolean;
  onCategoriesChanged?: () => void;
}

interface CategoryTotal {
  minutes: number;
  color?: string;
}

export function SessionHistory({
  refresh,
  darkMode = false,
  onCategoriesChanged,
}: SessionHistoryProps) {
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const { user } = useAuth();

  const loadSessions = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('timer_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });

    if (!error && data) {
      setSessions(data);
    }
    setLoading(false);
  };

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

  useEffect(() => {
    loadSessions();
  }, [user, refresh]);

  useEffect(() => {
    loadCategories();
  }, [user]);

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Delete this session?')) return;

    const { error } = await supabase
      .from('timer_sessions')
      .delete()
      .eq('id', id);

    if (!error) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return 'Today';
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const categoryColorMap: Record<string, string> = {};
  categories.forEach((cat) => {
    categoryColorMap[cat.name] = cat.color;
  });

  const sessionCategoryNames = Array.from(
    new Set(sessions.map((s) => s.category || 'General'))
  );

  const allCategoryOptions = [
    'All',
    'General',
    ...sessionCategoryNames.filter((c) => c !== 'General'),
  ];

  const filteredSessions =
    selectedCategory === 'All'
      ? sessions
      : sessions.filter(
          (s) => (s.category || 'General') === selectedCategory
        );

  const totalMinutes = filteredSessions.reduce(
    (sum, session) => sum + session.duration_minutes,
    0
  );
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const categoryTotals = filteredSessions.reduce<Record<string, CategoryTotal>>(
    (acc, session) => {
      const name = session.category || 'General';
      const color = categoryColorMap[name];

      if (!acc[name]) {
        acc[name] = { minutes: 0, color };
      }
      acc[name].minutes += session.duration_minutes;
      if (!acc[name].color && color) {
        acc[name].color = color;
      }
      return acc;
    },
    {}
  );

  // ---------- Subjects (categories) management ----------

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const name = newCategoryName.trim();
    if (!name) {
      setCategoryMessage('Subject name is required.');
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
        setCategoryMessage('This subject already exists.');
      } else {
        setCategoryMessage(`Failed to add subject: ${error.message}`);
      }
    } else if (data) {
      setCategories((prev) => [...prev, data]);
      setCategoryMessage('Subject added.');
      setNewCategoryName('');
      onCategoriesChanged?.();
    }

    setCategoryLoading(false);
  };

  const startEditingCategory = (name: string) => {
    setEditingCategory(name);
    setEditingCategoryName(name);
    setCategoryMessage(null);
  };

  const handleRenameCategory = async (e: FormEvent, oldName: string) => {
    e.preventDefault();
    if (!user) return;

    const newName = editingCategoryName.trim();
    if (!newName) {
      setCategoryMessage('Subject name is required.');
      return;
    }

    if (newName === oldName) {
      setEditingCategory(null);
      return;
    }

    setCategoryLoading(true);
    setCategoryMessage(null);

    const { error: catError } = await supabase
      .from('categories')
      .update({ name: newName })
      .eq('user_id', user.id)
      .eq('name', oldName);

    if (catError) {
      console.error('Error renaming category', catError);
      if (catError.message.includes('categories_user_id_name_idx')) {
        setCategoryMessage('A subject with this name already exists.');
      } else {
        setCategoryMessage('Failed to rename subject.');
      }
      setCategoryLoading(false);
      return;
    }

    const { error: sessError } = await supabase
      .from('timer_sessions')
      .update({ category: newName })
      .eq('user_id', user.id)
      .eq('category', oldName);

    if (sessError) {
      console.error('Error updating sessions category', sessError);
      setCategoryMessage('Subject renamed, but failed to update some sessions.');
    } else {
      setCategoryMessage('Subject renamed.');
      setSessions((prev) =>
        prev.map((s) =>
          s.category === oldName ? { ...s, category: newName } : s
        )
      );
    }

    setCategories((prev) =>
      prev.map((c) => (c.name === oldName ? { ...c, name: newName } : c))
    );

    if (selectedCategory === oldName) {
      setSelectedCategory(newName);
    }

    setEditingCategory(null);
    setCategoryLoading(false);
    onCategoriesChanged?.();
  };

  const handleDeleteCategory = async (name: string) => {
    if (!user) return;

    if (
      !confirm(
        `Delete subject "${name}"? Sessions using it will be set to "General".`
      )
    ) {
      return;
    }

    setCategoryLoading(true);
    setCategoryMessage(null);

    const { error: sessError } = await supabase
      .from('timer_sessions')
      .update({ category: 'General' })
      .eq('user_id', user.id)
      .eq('category', name);

    if (sessError) {
      console.error('Error updating sessions for deleted category', sessError);
      setCategoryMessage('Failed to update sessions for this subject.');
      setCategoryLoading(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('user_id', user.id)
      .eq('name', name);

    if (deleteError) {
      console.error('Error deleting category', deleteError);
      setCategoryMessage('Failed to delete subject.');
    } else {
      setCategories((prev) => prev.filter((c) => c.name !== name));
      setSessions((prev) =>
        prev.map((s) =>
          s.category === name ? { ...s, category: 'General' } : s
        )
      );
      if (selectedCategory === name) {
        setSelectedCategory('All');
      }
      setCategoryMessage('Subject deleted.');
    }

    setCategoryLoading(false);
    onCategoriesChanged?.();
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <div
        className={`${
          darkMode ? 'bg-slate-800' : 'bg-white'
        } rounded-2xl shadow-xl p-8 w-full max-w-2xl`}
      >
        <p
          className={`text-center ${
            darkMode ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div
      className={`${
        darkMode ? 'bg-slate-800' : 'bg-white'
      } rounded-2xl shadow-xl p-8 w-full max-w-2xl`}
    >
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="space-y-2">
          <h2
            className={`text-2xl font-bold ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}
          >
            Session History
          </h2>

          {/* Subject filter */}
          <div className="flex items-center gap-2 text-sm">
            <span
              className={darkMode ? 'text-gray-400' : 'text-gray-600'}
            >
              Subject:
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`px-2 py-1 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                darkMode
                  ? 'bg-slate-700 border-slate-600 text-gray-100'
                  : 'bg-white border-gray-300 text-gray-800'
              }`}
            >
              {allCategoryOptions.map((name) => (
                <option key={name} value={name}>
                  {name === 'All' ? 'All subjects' : name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {totalMinutes > 0 && (
          <div className="text-right space-y-2">
            <div>
              <div
                className={`text-sm ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Total Time
                {selectedCategory !== 'All' && (
                  <span className="ml-1 text-xs opacity-80">
                    ({selectedCategory})
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {totalHours > 0 && `${totalHours}h `}
                {remainingMinutes}m
              </div>
            </div>

            <div className="mt-1 max-h-24 overflow-y-auto space-y-1">
              {Object.entries(categoryTotals).map(([name, info]) => (
                <div
                  key={name}
                  className={`text-xs flex items-center justify-between ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {info.color && (
                      <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: info.color }}
                      />
                    )}
                    <span className="truncate">{name}</span>
                  </div>
                  <span className="ml-2 font-medium flex-shrink-0">
                    {info.minutes >= 60
                      ? `${Math.floor(info.minutes / 60)}h ${
                          info.minutes % 60
                        }m`
                      : `${info.minutes}m`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sessions list */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-12">
          <Clock
            className={`w-16 h-16 mx-auto mb-4 ${
              darkMode ? 'text-slate-600' : 'text-gray-300'
            }`}
          />
          <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
            {selectedCategory === 'All'
              ? 'No sessions yet. Start your first timer!'
              : 'No sessions for this subject yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[350px] overflow-y-auto">
          {filteredSessions.map((session) => {
            const catName = session.category || 'General';
            const catColor = categoryColorMap[catName];

            return (
              <div
                key={session.id}
                className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                  darkMode
                    ? 'bg-slate-700 hover:bg-slate-600'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <h3
                    className={`font-semibold ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {session.name}
                  </h3>

                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] max-w-[140px] truncate"
                      style={
                        catColor
                          ? {
                              backgroundColor: catColor,
                              borderColor: catColor,
                              color: '#ffffff',
                            }
                          : undefined
                      }
                    >
                      {catName}
                    </span>
                  </div>

                  <div
                    className={`flex items-center gap-4 mt-1 text-sm ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{session.duration_minutes} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {formatDate(session.completed_at)} at{' '}
                        {formatTime(session.completed_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className={`transition-colors p-2 ${
                    darkMode
                      ? 'text-gray-500 hover:text-red-500'
                      : 'text-gray-400 hover:text-red-600'
                  }`}
                  title="Delete session"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Manage Subjects */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
        <h3
          className={`text-sm font-semibold mb-3 ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}
        >
          Manage Subjects
        </h3>

        <form
          onSubmit={handleAddCategory}
          className="space-y-2 text-sm mb-3"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New subject name"
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
              title="Subject color"
            />
            <button
              type="submit"
              disabled={categoryLoading}
              className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </form>

        {categories.length > 0 && (
          <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
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
                        onChange={(e) =>
                          setEditingCategoryName(e.target.value)
                        }
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
            className={`mt-2 text-xs ${
              categoryMessage.toLowerCase().includes('fail')
                ? 'text-red-500'
                : 'text-gray-500'
            }`}
          >
            {categoryMessage}
          </p>
        )}
      </div>
    </div>
  );
}
