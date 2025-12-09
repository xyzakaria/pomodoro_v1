import { useEffect, useState } from 'react';
import { BookOpen, Clock, Target, Play } from 'lucide-react';
import { supabase, Lecture, TimerSession, Category } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ToDoLecturesProps {
  refresh: number;
  darkMode: boolean;
  onStartLecture?: (lectureId: string, subjectName: string) => void;
}

interface LectureProgress {
  lecture: Lecture;
  minutesCompleted: number;
  targetMinutes: number;
  progress: number;
  categoryColor?: string;
}

export function ToDoLectures({
  refresh,
  darkMode,
  onStartLecture,
}: ToDoLecturesProps) {
  const [lectureProgress, setLectureProgress] = useState<LectureProgress[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const { user } = useAuth();

  const loadData = async () => {
    if (!user) return;

    setLoading(true);

    const [lecturesRes, sessionsRes, categoriesRes] = await Promise.all([
      supabase
        .from('lectures')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('timer_sessions')
        .select('*')
        .eq('user_id', user.id)
        .not('lecture_id', 'is', null),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id),
    ]);

    if (lecturesRes.data && sessionsRes.data && categoriesRes.data) {
      const lectures = lecturesRes.data;
      const sessions = sessionsRes.data;
      const cats = categoriesRes.data;

      setCategories(cats);

      const categoryColorMap: Record<string, string> = {};
      cats.forEach((cat) => {
        categoryColorMap[cat.name] = cat.color;
      });

      const sessionsByLecture: Record<string, number> = {};
      sessions.forEach((session) => {
        if (session.lecture_id) {
          sessionsByLecture[session.lecture_id] =
            (sessionsByLecture[session.lecture_id] || 0) +
            session.duration_minutes;
        }
      });

      const progress: LectureProgress[] = lectures
        .filter((lecture) => lecture.target_minutes && lecture.target_minutes > 0)
        .map((lecture) => {
          const minutesCompleted = sessionsByLecture[lecture.id] || 0;
          const targetMinutes = lecture.target_minutes || 0;
          const progressPercent =
            targetMinutes > 0 ? (minutesCompleted / targetMinutes) * 100 : 0;

          return {
            lecture,
            minutesCompleted,
            targetMinutes,
            progress: Math.min(progressPercent, 100),
            categoryColor: categoryColorMap[lecture.subject_name],
          };
        })
        .sort((a, b) => a.progress - b.progress);

      setLectureProgress(progress);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user, refresh]);

  const filteredProgress =
    selectedSubject === 'All'
      ? lectureProgress
      : lectureProgress.filter(
          (p) => p.lecture.subject_name === selectedSubject
        );

  const subjects = [
    'All',
    ...Array.from(new Set(lectureProgress.map((p) => p.lecture.subject_name))),
  ];

  const incompleteLectures = filteredProgress.filter((p) => p.progress < 100);
  const completedLectures = filteredProgress.filter((p) => p.progress >= 100);

  if (loading) {
    return (
      <div
        className={`${
          darkMode ? 'bg-slate-800' : 'bg-white'
        } rounded-2xl shadow-xl p-8 w-full max-w-4xl`}
      >
        <p
          className={`text-center ${
            darkMode ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Loading lectures...
        </p>
      </div>
    );
  }

  return (
    <div
      className={`${
        darkMode ? 'bg-slate-800' : 'bg-white'
      } rounded-2xl shadow-xl p-8 w-full max-w-4xl`}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-xl">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2
              className={`text-2xl font-bold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              Lecture Goals
            </h2>
            <p
              className={`text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Track your progress towards lecture targets
            </p>
          </div>
        </div>

        {subjects.length > 1 && (
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className={`px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              darkMode
                ? 'bg-slate-700 border-slate-600 text-gray-100'
                : 'bg-white border-gray-300 text-gray-800'
            }`}
          >
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject === 'All' ? 'All Subjects' : subject}
              </option>
            ))}
          </select>
        )}
      </div>

      {filteredProgress.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen
            className={`w-20 h-20 mx-auto mb-4 ${
              darkMode ? 'text-slate-600' : 'text-gray-300'
            }`}
          />
          <h3
            className={`text-lg font-semibold mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            No Lecture Goals Yet
          </h3>
          <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
            Create lectures with target minutes in the History tab to start
            tracking your progress
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {incompleteLectures.length > 0 && (
            <div>
              <h3
                className={`text-sm font-semibold mb-3 uppercase tracking-wide ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                In Progress ({incompleteLectures.length})
              </h3>
              <div className="space-y-3">
                {incompleteLectures.map((item) => (
                  <div
                    key={item.lecture.id}
                    className={`p-5 rounded-xl border-2 transition-all hover:shadow-lg ${
                      darkMode
                        ? 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                        : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen
                            className={`w-4 h-4 ${
                              darkMode ? 'text-emerald-400' : 'text-emerald-600'
                            }`}
                          />
                          <h4
                            className={`font-semibold text-lg ${
                              darkMode ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {item.lecture.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.categoryColor && (
                            <span
                              className="inline-block w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.categoryColor }}
                            />
                          )}
                          <span
                            className={`text-sm ${
                              darkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}
                          >
                            {item.lecture.subject_name}
                          </span>
                        </div>
                      </div>
                      {onStartLecture && (
                        <button
                          onClick={() =>
                            onStartLecture(
                              item.lecture.id,
                              item.lecture.subject_name
                            )
                          }
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md"
                        >
                          <Play className="w-4 h-4" />
                          Start
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Clock
                            className={`w-4 h-4 ${
                              darkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}
                          />
                          <span
                            className={
                              darkMode ? 'text-gray-300' : 'text-gray-700'
                            }
                          >
                            {item.minutesCompleted} / {item.targetMinutes} min
                          </span>
                        </div>
                        <span
                          className={`font-bold ${
                            darkMode ? 'text-emerald-400' : 'text-emerald-600'
                          }`}
                        >
                          {Math.round(item.progress)}%
                        </span>
                      </div>
                      <div
                        className={`h-3 rounded-full overflow-hidden ${
                          darkMode ? 'bg-slate-600' : 'bg-gray-200'
                        }`}
                      >
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 rounded-full"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedLectures.length > 0 && (
            <div>
              <h3
                className={`text-sm font-semibold mb-3 uppercase tracking-wide ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Completed ({completedLectures.length})
              </h3>
              <div className="space-y-2">
                {completedLectures.map((item) => (
                  <div
                    key={item.lecture.id}
                    className={`p-4 rounded-xl border transition-all ${
                      darkMode
                        ? 'bg-emerald-900/20 border-emerald-700/50'
                        : 'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4
                            className={`font-semibold ${
                              darkMode ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {item.lecture.title}
                          </h4>
                          <div className="flex items-center gap-2 text-sm">
                            {item.categoryColor && (
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: item.categoryColor }}
                              />
                            )}
                            <span
                              className={
                                darkMode ? 'text-gray-400' : 'text-gray-600'
                              }
                            >
                              {item.lecture.subject_name}
                            </span>
                            <span
                              className={
                                darkMode ? 'text-gray-500' : 'text-gray-400'
                              }
                            >
                              •
                            </span>
                            <span
                              className={
                                darkMode ? 'text-gray-400' : 'text-gray-600'
                              }
                            >
                              {item.minutesCompleted} min
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-sm font-bold ${
                            darkMode ? 'text-emerald-400' : 'text-emerald-600'
                          }`}
                        >
                          ✓ Complete
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
