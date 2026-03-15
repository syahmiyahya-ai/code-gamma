import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Pin, 
  X, 
  User as UserIcon, 
  Calendar as CalendarIcon,
  MessageSquare,
  Send,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { hasPermission, UserRole } from '../../../shared/auth/permissions';

interface Announcement {
  id: number;
  title: string;
  content: string;
  author_id: string;
  author_name?: string;
  is_pinned: boolean;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  role: UserRole;
}

interface NoticeBoardProps {
  currentUser: User | null;
  users: User[];
  compact?: boolean;
}

export const NoticeBoard: React.FC<NoticeBoardProps> = ({ currentUser, users, compact = false }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      setAnnouncements(data);
    } catch (err) {
      console.error("Failed to fetch announcements", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      // Pinned first
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      // Then by date descending
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [announcements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          author_id: currentUser.id,
          is_pinned: isPinned
        })
      });

      if (res.ok) {
        await fetchAnnouncements();
        setShowModal(false);
        setTitle('');
        setContent('');
        setIsPinned(false);
      }
    } catch (err) {
      console.error("Failed to create announcement", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  return (
    <div className={`${compact ? '' : 'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full'}`}>
      {/* Header */}
      {!compact && (
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Notice Board</h2>
              <p className="text-xs text-slate-500 font-medium">Latest hospital updates</p>
            </div>
          </div>
          
          {hasPermission(currentUser?.role, 'post_announcements') && (
            <button 
              onClick={() => setShowModal(true)}
              className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 px-4 py-2 text-xs font-bold"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New Announcement</span>
            </button>
          )}
        </div>
      )}

      {/* List */}
      <div className={`${compact ? 'space-y-4' : 'flex-1 overflow-y-auto p-6 space-y-4 max-h-[600px]'}`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium">Loading notices...</p>
          </div>
        ) : sortedAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-slate-400 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
              <MessageSquare size={32} strokeWidth={1} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600">No announcements yet</p>
              <p className="text-xs">Check back later for updates.</p>
            </div>
          </div>
        ) : (
          sortedAnnouncements.map((announcement) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={announcement.id} 
              className={`p-5 rounded-2xl border transition-all hover:shadow-md group relative ${announcement.is_pinned ? 'bg-amber-50/30 border-amber-200' : 'bg-white border-slate-100 hover:border-indigo-100'}`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {announcement.is_pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-tighter">
                          <Pin size={10} />
                          Pinned
                        </span>
                      )}
                      <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {announcement.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {announcement.content}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100/50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <UserIcon size={12} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                      {announcement.author_name || 'System'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <CalendarIcon size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-tight">
                      {formatDate(announcement.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* New Announcement Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">New Announcement</h3>
                    <p className="text-xs text-slate-500 font-medium">Broadcast to all hospital staff</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Upcoming Maintenance"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-sm font-medium"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Content</label>
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your announcement here..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-sm font-medium min-h-[150px] resize-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPinned ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                      <Pin size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Pin Announcement</p>
                      <p className="text-[10px] text-slate-500 font-medium">Keep at the top of the board</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsPinned(!isPinned)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isPinned ? 'bg-amber-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPinned ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                    Post Notice
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
