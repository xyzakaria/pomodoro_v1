import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { supabase, Note } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface NotesPanelProps {
  onClose: () => void;
}

export function NotesPanel({ onClose }: NotesPanelProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const loadNotes = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setNotes(data);
  };

  useEffect(() => {
    loadNotes();
  }, [user]);

  const addNote = async () => {
    if (!user || !content.trim()) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        content: content.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setContent('');
    }

    setLoading(false);
  };

  const deleteNote = async (id: string) => {
    await supabase.from('notes').delete().eq('id', id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Notes
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500 hover:text-gray-800 dark:hover:text-white" />
          </button>
        </div>

        {/* Input */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a note..."
          className="w-full h-20 resize-none px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600
                     bg-white dark:bg-slate-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-violet-500 focus:outline-none"
        />

        <button
          onClick={addNote}
          disabled={loading}
          className="mt-2 w-full bg-gradient-to-r from-violet-500 to-purple-600
                     text-white font-semibold py-2 rounded-lg hover:opacity-90
                     disabled:opacity-50"
        >
          Add note
        </button>

        {/* Notes list */}
        <div className="mt-4 space-y-2 overflow-y-auto max-h-[40vh]">
          {notes.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              No notes yet.
            </p>
          )}

          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-gray-100 dark:bg-slate-700 rounded-lg p-3 text-sm"
            >
              <div className="flex justify-between items-start gap-2">
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {note.content}
                </p>
                <button onClick={() => deleteNote(note.id)}>
                  <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {new Date(note.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
