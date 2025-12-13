import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, TimerSession } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface StudyCalendarProps {
  refresh: number;
  darkMode: boolean;
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

  const getDailyMinutes = (day: number) => {
    const dateStr = new Date(year, month, day).toDateString();
    return sessions
      .filter((session) => new Date(session.completed_at).toDateString() === dateStr)
      .reduce((sum, session) => sum + session.duration_minutes, 0);
  };

  const totalMinutes = sessions.reduce((sum, session) => sum + session.duration_minutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // New thresholds (study-realistic):
  // 0 = none
  // 1-60 = 1h
  // 61-120 = 2h
  // 121-240 = 4h
  // 241-360 = 6h
  // 361-480 = 8h
  // 481+ = SPECIAL (violet)
  const getColorForMinutes = (minutes: number) => {
    if (minutes === 0) return darkMode ? 'bg-slate-700' : 'bg-gray-50';

    // SPECIAL: 8h+ (more than 480 minutes)
    if (minutes > 480) return darkMode ? 'bg-violet-700' : 'bg-violet-300';

    if (minutes <= 60) return darkMode ? 'bg-blue-950' : 'bg-blue-50';
    if (minutes <= 120) return darkMode ? 'bg-blue-900' : 'bg-blue-100';
    if (minutes <= 240) return darkMode ? 'bg-blue-800' : 'bg-blue-200';
    if (minutes <= 360) return darkMode ? 'bg-blue-700' : 'bg-blue-300';
    // 361-480 (8h)
    return darkMode ? 'bg-blue-600' : 'bg-blue-400';
  };

  const calendarDays: Array<number | null> = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

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
          const minutes = day ? getDailyMinutes(day) : 0;
          const isSpecial = minutes > 480;

          return (
            <div
              key={index}
              className={`aspect-square rounded p-1 flex flex-col items-center justify-center text-center transition-all ${
                day ? getColorForMinutes(minutes) : (darkMode ? 'bg-slate-700' : 'bg-gray-50')
              } ${day && 'cursor-default'} ${isSpecial ? 'ring-2 ring-violet-400/70 dark:ring-violet-300/60' : ''}`}
              title={day ? `${minutes} minutes` : ''}
            >
              {day && (
                <>
                  <div className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {day}
                  </div>
                  <div
                    className={`text-xs font-bold mt-0.5 ${
                      minutes === 0
                        ? (darkMode ? 'text-gray-500' : 'text-gray-400')
                        : (darkMode ? 'text-white' : 'text-gray-900')
                    }`}
                  >
                    {minutes > 0 ? `${minutes}m` : '—'}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

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
            <span className="text-xs text-gray-600 dark:text-gray-400">8h+ ⭐</span>
          </div>
        </div>
      </div>
    </div>
  );
}
