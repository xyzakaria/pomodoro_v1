import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { PomodoroTimer } from './components/PomodoroTimer';
import { SessionHistory } from './components/SessionHistory';
import { StudyCalendar } from './components/StudyCalendar';
import { LogOut, Timer, Moon, Sun } from 'lucide-react';

function App() {
  const { user, loading, signOut } = useAuth();
  const [refreshHistory, setRefreshHistory] = useState(0);
  const [activeTab, setActiveTab] = useState<'timer' | 'calendar'>('timer');
  const [categoriesVersion, setCategoriesVersion] = useState(0);
  const [lecturesVersion, setLecturesVersion] = useState(0); // 👈 NEW

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;

    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;

    return (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-xl text-gray-600 dark:text-gray-400">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4 transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-8 pt-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Timer className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Pomodoro Timer
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 hover:bg-white/20 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </header>

        <div className="mb-6">
          <div className="flex gap-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1 w-fit">
            <button
              onClick={() => setActiveTab('timer')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'timer'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              Timer
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'calendar'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className={activeTab === 'timer' ? 'block' : 'hidden'}>
            <div className="grid lg:grid-cols-2 gap-6 items-start">
              <div className="flex justify-center">
                <PomodoroTimer
                  onSessionComplete={() =>
                    setRefreshHistory((prev) => prev + 1)
                  }
                  darkMode={darkMode}
                  categoriesVersion={categoriesVersion}
                  lecturesVersion={lecturesVersion} // 👈 NEW
                />
              </div>
              <div className="flex justify-center">
                <SessionHistory
                  refresh={refreshHistory}
                  darkMode={darkMode}
                  onCategoriesChanged={() =>
                    setCategoriesVersion((prev) => prev + 1)
                  }
                  onLecturesChanged={() =>
                    setLecturesVersion((prev) => prev + 1) // 👈 NEW
                  }
                />
              </div>
            </div>
          </div>

          <div
            className={
              activeTab === 'calendar' ? 'flex justify-center' : 'hidden'
            }
          >
            <StudyCalendar refresh={refreshHistory} darkMode={darkMode} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
