import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Clock, 
  Calendar, 
  CheckSquare, 
  Bell, 
  ChevronRight, 
  AlertCircle,
  Pin,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

interface Shift {
  id: number;
  date: string;
  shift_code: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  is_code_blue: number;
  background_color: string;
  text_color: string;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  is_pinned: number;
  created_at: string;
}

export const DashboardHome: React.FC = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [nextShift, setNextShift] = useState<Shift | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!profile?.id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [shiftRes, countRes, annRes] = await Promise.all([
          fetch(`/api/shifts/next?user_id=${profile.id}`),
          fetch(`/api/tasks/pending-count?user_id=${profile.id}`),
          fetch(`/api/announcements`)
        ]);

        const getJson = async (res: Response, name: string) => {
          if (!res.ok) {
            const text = await res.text().catch(() => "No body");
            console.error(`[DASHBOARD] ${name} fetch failed (${res.status}):`, text.slice(0, 100));
            return null;
          }
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text().catch(() => "No body");
            console.error(`[DASHBOARD] ${name} returned non-JSON (${contentType}):`, text.slice(0, 100));
            return null;
          }
          return res.json();
        };

        const shiftData = await getJson(shiftRes, "Next Shift");
        const countData = await getJson(countRes, "Pending Count");
        const annData = await getJson(annRes, "Announcements");

        if (shiftData) setNextShift(shiftData);
        if (countData) setPendingCount(countData.count);
        if (annData) setAnnouncements(annData.slice(0, 2));
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.id, authLoading]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatShiftDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
    if (dateStr === today) return 'Today';
    
    return date.toLocaleDateString('en-MY', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Welcome Section */}
      <section className="flex items-center gap-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 lg:w-24 lg:h-24 rounded-3xl bg-slate-200 overflow-hidden shadow-xl border-4 border-white shrink-0"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-600 font-black text-2xl">
              {profile?.name?.charAt(0)}
            </div>
          )}
        </motion.div>
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">
            {getGreeting()}, {profile?.name}
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">
            {profile?.role} • ACCU Division
          </p>
        </div>
      </section>

      {/* Next Shift Widget */}
      <section>
        <Link to="/roster" className="block">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-emerald-900/20 hover:scale-[1.01] transition-transform"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Next Shift</span>
                </div>
                {nextShift?.is_code_blue === 1 && (
                  <div className="px-3 py-1 bg-rose-500 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse shadow-lg shadow-rose-900/40 border border-rose-400/50">
                    Code Blue Duty
                  </div>
                )}
              </div>

              {nextShift ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-4xl font-black tracking-tight">
                      {formatShiftDate(nextShift.date)}
                    </h2>
                    <p className="text-lg font-bold opacity-90">
                      {nextShift.shift_name} ({nextShift.start_time?.slice(0, 5)} - {nextShift.end_time?.slice(0, 5)})
                    </p>
                  </div>
                  <div className="pt-4 flex items-center gap-4">
                    <div className="px-6 py-3 bg-white text-emerald-700 rounded-2xl text-sm font-black shadow-lg">
                      View Full Roster
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  <p className="text-lg font-bold opacity-80 italic">No upcoming shifts scheduled.</p>
                </div>
              )}
            </div>
          </motion.div>
        </Link>
      </section>

      {/* Quick-Glance Widgets */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pending Tasks Snippet */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col justify-between gap-6 group hover:shadow-md transition-shadow"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <CheckSquare size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Pending Tasks</h3>
              <p className="text-slate-500 font-medium">
                You have <span className="text-blue-600 font-black">{pendingCount}</span> pending tasks to complete.
              </p>
            </div>
          </div>
          <Link 
            to="/tasks" 
            className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors"
          >
            <span className="text-sm font-black text-slate-700 group-hover:text-blue-700">View Tasks</span>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-500" />
          </Link>
        </motion.div>

        {/* Notice Board Snippet */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col justify-between gap-6 group hover:shadow-md transition-shadow"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
              <Bell size={24} />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Notice Board</h3>
                <Link to="/intranet" className="text-[10px] font-black text-amber-600 uppercase tracking-widest">View All</Link>
              </div>
              <div className="space-y-3">
                {announcements.length > 0 ? announcements.map(ann => (
                  <div key={ann.id} className="flex items-start gap-3">
                    <div className="mt-1 shrink-0">
                      {ann.is_pinned === 1 ? <Pin size={14} className="text-rose-500 fill-rose-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5" />}
                    </div>
                    <p className="text-sm font-bold text-slate-700 line-clamp-1">{ann.title}</p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-400 italic">No recent announcements.</p>
                )}
              </div>
            </div>
          </div>
          <Link 
            to="/intranet" 
            className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group-hover:bg-amber-50 transition-colors"
          >
            <span className="text-sm font-black text-slate-700 group-hover:text-amber-700">Intranet</span>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-amber-500" />
          </Link>
        </motion.div>
      </section>
    </div>
  );
};
