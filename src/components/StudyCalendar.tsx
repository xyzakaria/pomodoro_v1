import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, TimerSession } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface StudyCalendarProps {
  refresh: number;
  darkMode: boolean;
}

function formatMinutesToHM(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function StudyCalendar({ refresh, darkMode }: StudyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadSessions = async () => {
    if (!user) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    setLoading(true);
    const { data, error } = await supabase
      .from('timer_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('completed_at', firstDay.toISOString())
      .lte('completed_at', lastDay.toISOString());

    if (!error && data) {
      setSessions(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentDate, refresh]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const previousMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Key: YYYY-MM-DD -> sessions[]
  const sessionsByDayKey = useMemo(() => {
    const map = new Map<string, TimerSession[]>();

    for (const s of sessions) {
      const d = new Date(s.completed_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }

    // sort sessions inside each day by time ascending (nice in tooltip)
    for (const [k, arr] of map) {
      arr.sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
      map.set(k, arr);
    }

    return map;
  }, [sessions]);

  const getDayKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const getDailyMinutes = (day: number) => {
    const key = getDayKey(day);
    const daySessions = sessionsByDayKey.get(key) ?? [];
    return daySessions.reduce((sum, s) => sum + s.duration_minutes, 0);
  };

  const totalMinutes = sessions.reduce((sum, session) => sum + session.duration_minutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  // Thresholds:
  // 0 none
  // 1-60
  // 61-120
  // 121-240
  // 241-360
  // 361-480 (8h)
  // 481+ SPECIAL (violet)
  const getColorForMinutes = (minutes: number) => {
    if (minutes === 0) return darkMode ? 'bg-slate-700' : 'bg-gray-50';

    if (minutes > 480) return darkMode ? 'bg-violet-700' : 'bg-violet-300';

    if (minutes <= 60) return darkMode ? 'bg-blue-950' : 'bg-blue-50';
    if (minutes <= 120) return darkMode ? 'bg-blue-900' : 'bg-blue-100';
    if (minutes <= 240) return darkMode ? 'bg-blue-800' : 'bg-blue-200';
    if (minutes <= 360) return darkMode ? 'bg-blue-700' : 'bg-blue-300';
    return darkMode ? 'bg-blue-600' : 'bg-blue-400';
  };

  const calendarDays: Array<number | null> = [];
  for (let i = 0; i < startingDayOfWeek; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  if (loading && sessions.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-4 w-full max-w-2xl">
        <p className="text-center text-gray-500 dark:text-gray-400">Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-4 w-full max-w-2xl">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {monthNames[month]} {year}
            </h2>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Time</div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {totalHours > 0 && `${totalHours}h `}
              {remainingMinutes}m
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={previousMonth}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
          >
            Today
          </button>

          <button
            onClick={nextMonth}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dayNames.map((day) => (
          <div key={day} className="text-center font-semibold text-gray-600 dark:text-gray-400 text-xs py-1">
            {day}
          </div>
        ))}

        {calendarDays.map((day, index) => {
          if (!day) {
            return (
              <div
                key={index}
                className={`aspect-square rounded p-1 ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}
              />
            );
          }

          const key = getDayKey(day);
          const daySessions = sessionsByDayKey.get(key) ?? [];
          const minutes = daySessions.reduce((sum, s) => sum + s.duration_minutes, 0);
          const isSpecial = minutes > 480;

          // Group by subject/category
          const byCategory = new Map<string, number>();
          for (const s of daySessions) {
            const cat = (s.category || 'General').trim() || 'General';
            byCategory.set(cat, (byCategory.get(cat) ?? 0) + s.duration_minutes);
          }
          const categoriesSorted = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);

          return (
            <div
              key={index}
              className={`group relative aspect-square rounded p-1 flex flex-col items-center justify-center text-center transition-all ${
                getColorForMinutes(minutes)
              } cursor-default ${isSpecial ? 'ring-2 ring-violet-400/70 dark:ring-violet-300/60' : ''}`}
            >
              {/* Day number + STAR for 8h+ */}
              <div className={`text-xs font-medium flex items-center gap-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <span>{day}</span>
                {isSpecial && (
                  <span
                    className={`${darkMode ? 'text-yellow-300' : 'text-yellow-600'}`}
                    title="Exceptional day (8h+)"
                  >
                    ★
                  </span>
                )}
              </div>

              {/* Minutes */}
              <div
                className={`text-xs font-bold mt-0.5 ${
                  minutes === 0
                    ? (darkMode ? 'text-gray-500' : 'text-gray-400')
                    : (darkMode ? 'text-white' : 'text-gray-900')
                }`}
              >
                {minutes > 0 ? `${minutes}m` : '—'}
              </div>

              {/* Tooltip (hover) */}
              {minutes > 0 && (
                <div
                  className={`pointer-events-none absolute z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150
                    left-1/2 -translate-x-1/2 top-full mt-2 w-56 rounded-xl shadow-xl border
                    ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}
                  `}
                >
                  <div className="p-3 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-xs font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        Day recap
                      </div>
                      <div className={`text-xs font-bold ${isSpecial ? (darkMode ? 'text-violet-300' : 'text-violet-700') : (darkMode ? 'text-blue-300' : 'text-blue-700')}`}>
                        {formatMinutesToHM(minutes)}
                      </div>
                    </div>

                    {/* Categories summary */}
                    <div className="space-y-1 mb-2">
                      <div className={`text-[11px] font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        By subject
                      </div>
                      <div className="space-y-1 max-h-20 overflow-auto pr-1">
                        {categoriesSorted.map(([cat, mins]) => (
                          <div
                            key={cat}
                            className={`text-[11px] flex items-center justify-between ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                          >
                            <span className="truncate max-w-[140px]">{cat}</span>
                            <span className="font-medium">{formatMinutesToHM(mins)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sessions list */}
                    <div className="space-y-1">
                      <div className={`text-[11px] font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Sessions
                      </div>
                      <div className="space-y-1 max-h-24 overflow-auto pr-1">
                        {daySessions.map((s) => (
                          <div
                            key={s.id}
                            className={`text-[11px] flex items-center justify-between gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                          >
                            <span className="truncate">
                              {s.name || 'Pomodoro Session'}
                            </span>
                            <span className="flex-shrink-0 font-medium">
                              {formatMinutesToHM(s.duration_minutes)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* small arrow */}
                    <div
                      className={`absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0
                        border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent
                        ${darkMode ? 'border-b-slate-900' : 'border-b-white'}
                      `}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Legend</h3>
        </div>

        <div className="grid grid-cols-7 gap-2">
          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">None</span>
          </div>

          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${darkMode ? 'bg-blue-950' : 'bg-blue-50'}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">1–60m</span>
          </div>

          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${darkMode ? 'bg-blue-900' : 'bg-blue-100'}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">61–120m</span>
          </div>

          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${darkMode ? 'bg-blue-800' : 'bg-blue-200'}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">2–4h</span>
          </div>

          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${darkMode ? 'bg-blue-700' : 'bg-blue-300'}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">4–6h</span>
          </div>

          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${darkMode ? 'bg-blue-600' : 'bg-blue-400'}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">6–8h</span>
          </div>

          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${darkMode ? 'bg-violet-700' : 'bg-violet-300'}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">8h+ ★</span>
          </div>
        </div>
      </div>
    </div>
  );
}
