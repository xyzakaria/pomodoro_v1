import { useEffect, useState } from 'react';
import { Clock, Calendar, Trash2 } from 'lucide-react';
import { supabase, TimerSession } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SessionHistoryProps {
  refresh: number;
  darkMode?: boolean;
}

export function SessionHistory({ refresh, darkMode = false }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadSessions();
  }, [user, refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;

    const { error } = await supabase
      .from('timer_sessions')
      .delete()
      .eq('id', id);

    if (!error) {
      setSessions(sessions.filter(s => s.id !== id));
    }
  };

  const totalMinutes = sessions.reduce((sum, session) => sum + session.duration_minutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

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
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-xl p-8 w-full max-w-2xl`}>
        <p className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>
      </div>
    );
  }

  return (
    <div className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-xl p-8 w-full max-w-2xl`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Session History</h2>
        {totalMinutes > 0 && (
          <div className="text-right">
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Time</div>
            <div className="text-2xl font-bold text-blue-600">
              {totalHours > 0 && `${totalHours}h `}
              {remainingMinutes}m
            </div>
          </div>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <Clock className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-gray-300'}`} />
          <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>No sessions yet. Start your first timer!</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex-1">
                <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{session.name}</h3>
                <div className={`flex items-center gap-4 mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{session.duration_minutes} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(session.completed_at)} at {formatTime(session.completed_at)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(session.id)}
                className={`transition-colors p-2 ${darkMode ? 'text-gray-500 hover:text-red-500' : 'text-gray-400 hover:text-red-600'}`}
                title="Delete session"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
