import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { PomodoroTimer } from './components/PomodoroTimer';
import { SessionHistory } from './components/SessionHistory';
import { StudyCalendar } from './components/StudyCalendar';
import { ToDoLectures } from './components/ToDoLectures';
import { ChatButton } from './components/ChatButton';
import { NotesPanel } from './components/NotesPanel';
import { LogOut, Timer, Moon, Sun } from 'lucide-react';

function App() {
  const { user, loading, signOut } = useAuth();

  const [refreshHistory, setRefreshHistory] = useState(0);
  const [activeTab, setActiveTab] =
    useState<'timer' | 'calendar' | 'lectures'>('timer');

  const [categoriesVersion, setCategoriesVersion] = useState(0);
  const [lecturesVersion, setLecturesVersion] = useState(0);

  const [startLectureData, setStartLectureData] = useState<{
    lectureId: string;
    subjectName: string;
  } | null>(null);

  // 📝 Notes (pilotées par le chat)
  const [notesOpen, setNotesOpen] = useState(false);

  // 🌙 Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
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

  useEffect(() => {
    if (startLectureData) {
      setActiveTab('timer');
    }
  }, [startLectureData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-gray-400">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  const handleStartLecture = (lectureId: string, subjectName: string) => {
    setStartLectureData({ lectureId, subjectName });
    setActiveTab('timer');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <header className="flex items-center justify-between mb-8 pt-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-3 rounded-xl shadow-lg">
              <Timer className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-cyan-700 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
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
              className="p-2.5 rounded-xl hover:bg-white/20 dark:hover:bg-white/10"
              title="Toggle theme"
            >
              {darkMode ? <Sun /> : <Moon />}
            </button>

            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl transition-all shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </header>

        {/* TABS */}
        <div className="mb-8">
          <div className="flex gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-lg p-1.5 w-fit">
            <button
              onClick={() => setActiveTab('timer')}
              className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                activeTab === 'timer'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              Timer
            </button>
            <button
              onClick={() => setActiveTab('lectures')}
              className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                activeTab === 'lectures'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              Lecture Goals
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                activeTab === 'calendar'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>

        {/* CONTENT */}
        {activeTab === 'timer' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <PomodoroTimer
              onSessionComplete={() => setRefreshHistory(v => v + 1)}
              darkMode={darkMode}
              categoriesVersion={categoriesVersion}
              lecturesVersion={lecturesVersion}
              startLectureData={startLectureData}
              onLectureStarted={() => setStartLectureData(null)}
            />

            <SessionHistory
              refresh={refreshHistory}
              darkMode={darkMode}
              onCategoriesChanged={() => setCategoriesVersion(v => v + 1)}
              onLecturesChanged={() => setLecturesVersion(v => v + 1)}
            />
          </div>
        )}

        {activeTab === 'lectures' && (
          <ToDoLectures
            refresh={refreshHistory}
            darkMode={darkMode}
            onStartLecture={handleStartLecture}
          />
        )}

        {activeTab === 'calendar' && (
          <StudyCalendar refresh={refreshHistory} darkMode={darkMode} />
        )}
      </div>

      {/* 🐱 CHAT BUTTON */}
      <ChatButton onClick={() => setNotesOpen(true)} />

      {/* 📝 NOTES PANEL */}
      {notesOpen && (
        <NotesPanel onClose={() => setNotesOpen(false)} />
      )}
    </div>
  );
}

export default App;
