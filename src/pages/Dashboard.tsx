import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Shield, 
  User as UserIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  AlertCircle,
  History,
  CheckCircle2,
  X,
  LayoutDashboard,
  FileText,
  Contact2,
  ListTodo,
  CheckSquare,
  ArrowRight,
  LogOut,
  ArrowRightLeft,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateDailySummary, ShiftRecord } from '../utils/rosterUtils';
import { AdminRosterTable } from '../components/AdminRosterTable';
import { AutomatedSummaryTable } from '../components/AutomatedSummaryTable';
import { StaffDashboardView } from '../components/StaffDashboardView';
import { NoticeBoard } from '../components/NoticeBoard';
import { DocumentLibrary } from '../components/DocumentLibrary';
import StaffDirectory from '../components/StaffDirectory';
import NotificationBell from '../components/NotificationBell';
import OwedDaysManager from '../components/OwedDaysManager';
import AdminTaskMonitor from '../components/AdminTaskMonitor';
import StaffTaskList from '../components/StaffTaskList';
import { UserProfile } from '../components/UserProfile';
import { ShiftSwapManager } from '../components/ShiftSwapManager';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

import { 
  hasPermission, 
  canManageRoster, 
  isAdministrator, 
  UserRole 
} from '../utils/permissions';

// --- Types ---
interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  email?: string;
  phone_number?: string;
}

interface ShiftType {
  code: string;
  background_color: string;
  text_color: string;
}

interface Shift {
  id?: number;
  user_id: string;
  date: string;
  shift_code: string;
  is_code_blue: number;
}

interface AuditLog {
  id: number;
  shift_id: number;
  action: string;
  changed_by: string;
  changer_name: string;
  old_data: string;
  new_data: string;
  timestamp: string;
}

// --- Constants ---
const SHIFT_CODES = ['EP', 'AM', 'PM', 'NS', 'PN', 'FL', 'WP', 'HK1', 'HK2', 'HK3', 'HK4', 'HKA', 'HKO', 'CR', 'EL'];

// --- Helper Components ---
function SidebarItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all relative group ${
        active 
          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
      </span>
      {label}
      {active && (
        <motion.div 
          layoutId="sidebar-active"
          className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
        />
      )}
    </button>
  );
}

export const Dashboard: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'roster' | 'docs' | 'directory' | 'tasks' | 'profile' | 'swaps'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('monthly');
  const [showLogs, setShowLogs] = useState(false);
  const [swaps, setSwaps] = useState<any[]>([]);
  const [summaryDate, setSummaryDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date()));

  const currentUser = profile;

  // --- Fetch Data ---
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const start = formatDate(viewMode === 'monthly' ? getStartDate(viewDate) : getWeekStartDate(viewDate));
        const end = formatDate(viewMode === 'monthly' ? getEndDate(viewDate) : getWeekEndDate(viewDate));

        const [usersRes, typesRes, shiftsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/shift-types'),
          fetch(`/api/shifts?start=${start}&end=${end}`)
        ]);
        
        const [usersData, typesData, shiftsData] = await Promise.all([
          usersRes.json(),
          typesRes.json(),
          shiftsRes.json()
        ]);
        
        setUsers(usersData);
        setShiftTypes(typesData);
        setShifts(shiftsData);

        // Fetch audit logs only if user is admin/manager
        if (hasPermission(profile?.role, 'view_admin_dashboard')) {
          fetch('/api/audit-logs')
            .then(res => res.json())
            .then(data => setAuditLogs(data))
            .catch(err => console.error("Failed to fetch audit logs", err));
        }
        
        if (profile?.id) {
          const [tasksRes, swapsRes] = await Promise.all([
            fetch(`/api/my-tasks?user_id=${profile.id}`),
            fetch(`/api/shift-swaps?status=PENDING`)
          ]);
          const [tasksData, swapsData] = await Promise.all([
            tasksRes.json(),
            swapsRes.json()
          ]);
          setAssignments(tasksData);
          setSwaps(swapsData);
        }
      } catch (err) {
        console.error("Failed to initialize app", err);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fetchShifts = async () => {
    const start = formatDate(viewMode === 'monthly' ? getStartDate(viewDate) : getWeekStartDate(viewDate));
    const end = formatDate(viewMode === 'monthly' ? getEndDate(viewDate) : getWeekEndDate(viewDate));
    const res = await fetch(`/api/shifts?start=${start}&end=${end}`);
    const data = await res.json();
    setShifts(data);
  };

  useEffect(() => {
    fetchShifts();
  }, [viewDate, viewMode]);

  // --- Helpers ---
  function getStartDate(date: Date) {
    const d = new Date(date);
    d.setDate(1);
    return d;
  }

  function getEndDate(date: Date) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0); // Last day of month
    return d;
  }

  function getWeekStartDate(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(d.setDate(diff));
  }

  function getWeekEndDate(date: Date) {
    const d = getWeekStartDate(date);
    d.setDate(d.getDate() + 6);
    return d;
  }

  function formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const dates = useMemo(() => {
    const start = viewMode === 'monthly' ? getStartDate(viewDate) : getWeekStartDate(viewDate);
    const end = viewMode === 'monthly' ? getEndDate(viewDate) : getWeekEndDate(viewDate);
    const arr = [];
    let curr = new Date(start);
    while (curr <= end) {
      arr.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return arr;
  }, [viewDate, viewMode]);

  const dailySummary: Record<string, string[]> = useMemo(() => {
    const enriched: ShiftRecord[] = shifts.map(s => ({
      doctorName: users.find(u => u.id === s.user_id)?.name || 'Unknown',
      date: s.date,
      shift_code: s.shift_code,
      is_code_blue: s.is_code_blue === 1
    }));
    return generateDailySummary(enriched, summaryDate);
  }, [shifts, users, summaryDate]);

  const pendingTasks = useMemo(() => {
    return assignments.filter(a => a.status === 'PENDING');
  }, [assignments]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 overflow-hidden relative">
        <div className="absolute inset-0 opacity-20">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-[120px]" 
          />
          <motion.div 
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
            transition={{ duration: 10, repeat: Infinity }}
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[120px]" 
          />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8">
          <motion.div 
            animate={{ 
              rotateY: [0, 180, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/40"
          >
            <CalendarIcon className="text-white w-12 h-12" />
          </motion.div>
          
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-white text-2xl font-bold tracking-tight">WardRoster</h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-slate-900 h-screen sticky top-0 z-40 overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-emerald-500/20 to-transparent" />
        </div>

        <div className="relative z-10 p-8 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
              <CalendarIcon size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">WardRoster</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">ACCU Division</p>
            </div>
          </div>
        </div>

        <nav className="relative z-10 flex-1 p-6 space-y-1.5 overflow-y-auto">
          <div className="pb-4">
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Main Menu</p>
            <div className="space-y-1">
              <SidebarItem 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')}
                icon={<LayoutDashboard size={20} />}
                label="Dashboard"
              />
              <SidebarItem 
                active={activeTab === 'roster'} 
                onClick={() => setActiveTab('roster')}
                icon={<CalendarIcon size={20} />}
                label="Roster"
              />
              <SidebarItem 
                active={activeTab === 'swaps'} 
                onClick={() => setActiveTab('swaps')}
                icon={<ArrowRightLeft size={20} />}
                label="Swaps"
              />
              <SidebarItem 
                active={activeTab === 'tasks'} 
                onClick={() => setActiveTab('tasks')}
                icon={<ListTodo size={20} />}
                label="Tasks"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Resources</p>
            <div className="space-y-1">
              <SidebarItem 
                active={activeTab === 'docs'} 
                onClick={() => setActiveTab('docs')}
                icon={<FileText size={20} />}
                label="Documents"
              />
              <SidebarItem 
                active={activeTab === 'directory'} 
                onClick={() => setActiveTab('directory')}
                icon={<Contact2 size={20} />}
                label="Directory"
              />
            </div>
          </div>
        </nav>

        {/* User Profile Section in Sidebar */}
        <div className="relative z-10 p-6 border-t border-white/5 bg-slate-900/50 backdrop-blur-md">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group ${activeTab === 'profile' ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 overflow-hidden shrink-0">
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  <UserIcon size={20} />
                </div>
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{currentUser.role}</p>
            </div>
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all border border-rose-500/20"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4 lg:hidden">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <CalendarIcon size={22} />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-800">Code Gamma ACCU</h1>
            </div>

            <div className="hidden lg:block">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                {activeTab}
              </h2>
            </div>

            <div className="flex items-center gap-4 lg:gap-6">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">API Connected</span>
              </div>
              <div className="flex items-center gap-3">
                <NotificationBell currentUserId={currentUser?.id || ''} />
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all text-sm font-bold"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] w-full mx-auto p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Welcome Banner */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden bg-slate-900 rounded-[2rem] p-8 lg:p-12 shadow-2xl shadow-slate-900/20"
              >
                <div className="absolute inset-0 opacity-20">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 8, repeat: Infinity }}
                    className="absolute top-0 right-0 w-96 h-96 bg-emerald-500 rounded-full blur-[120px] -mr-48 -mt-48" 
                  />
                  <motion.div 
                    animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
                    transition={{ duration: 10, repeat: Infinity }}
                    className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-[120px] -ml-48 -mb-48" 
                  />
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 lg:gap-12">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative w-32 h-32 lg:w-40 lg:h-40 rounded-[2.25rem] bg-slate-800 border-4 border-white/10 overflow-hidden shadow-2xl shrink-0">
                      {currentUser.avatar_url ? (
                        <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-800">
                          <UserIcon size={64} />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-center md:text-left space-y-4">
                    <div className="space-y-1">
                      <p className="text-emerald-400 text-sm font-black uppercase tracking-[0.3em]">Welcome back</p>
                      <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight">
                        {currentUser.name.split(' ')[0]}<span className="text-slate-500">.</span>
                      </h1>
                    </div>
                    <p className="text-slate-400 font-medium max-w-xl text-sm lg:text-base leading-relaxed">
                      You're logged in as <span className="text-white font-bold">{currentUser.role}</span>. 
                      Your presence today ensures the highest standard of care in the ACCU Division.
                    </p>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                      <div className="px-4 py-2 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">System Online</span>
                      </div>
                      <div className="px-4 py-2 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-2">
                        <Clock size={14} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Today's Team & Notice Board */}
                <div className="lg:col-span-8 space-y-8">
                  {/* Today's Team Card */}
                  <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-indigo-500/10 transition-colors duration-500" />
                    
                    <div className="relative z-10 space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
                            <Users size={32} />
                          </div>
                          <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Today's Team</h2>
                            <p className="text-sm text-slate-500 font-medium">Active medical staff for {summaryDate}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* EP Section */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Shield size={16} className="text-indigo-600" />
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">EP Incharge</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {dailySummary['EP'] && dailySummary['EP'].length > 0 ? (
                              dailySummary['EP'].map((name, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 px-4 py-2.5 rounded-xl">
                                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                  <span className="text-xs font-black text-indigo-900">{name}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400 italic">No EP assigned</p>
                            )}
                          </div>
                        </div>

                        {/* MO Section */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Users size={16} className="text-emerald-600" />
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">MOs on Duty</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(dailySummary)
                              .filter(([code]) => ['AM', 'PM', 'NS', 'FL', 'WP'].includes(code))
                              .flatMap(([code, names]) => names.map(name => ({ name, code })))
                              .length > 0 ? (
                              Object.entries(dailySummary)
                                .filter(([code]) => ['AM', 'PM', 'NS', 'FL', 'WP'].includes(code))
                                .flatMap(([code, names]) => names.map(name => ({ name, code })))
                                .map((mo, idx) => (
                                  <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                      mo.code === 'AM' ? 'bg-emerald-100 text-emerald-700' :
                                      mo.code === 'PM' ? 'bg-amber-100 text-amber-700' :
                                      mo.code === 'NS' ? 'bg-blue-100 text-blue-700' :
                                      'bg-slate-200 text-slate-700'
                                    }`}>{mo.code}</span>
                                    <span className="text-xs font-bold text-slate-700">{mo.name}</span>
                                  </div>
                                ))
                            ) : (
                              <p className="text-xs text-slate-400 italic">No MOs assigned</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notice Board Snippet */}
                  <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                          <MessageSquare size={24} />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-slate-800 tracking-tight">Notice Board</h2>
                          <p className="text-sm text-slate-500 font-medium">Latest announcements</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab('roster')} // Or wherever notice board is fully
                        className="text-xs font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors"
                      >
                        View All
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                      <NoticeBoard currentUser={currentUser} users={users} compact={true} />
                    </div>
                  </div>
                </div>

                {/* Right Column: Pending Tasks */}
                <div className="lg:col-span-4 space-y-8">
                  {/* Pending Tasks Snippet */}
                  <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm flex flex-col gap-6 relative overflow-hidden group h-full">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-colors duration-500" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                          <CheckSquare size={24} />
                        </div>
                        <div>
                          <h2 className="text-lg font-black text-slate-800 tracking-tight">Pending Tasks</h2>
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">
                            {pendingTasks.length} {pendingTasks.length === 1 ? 'task' : 'tasks'} remaining
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab('tasks')}
                        className="p-3 bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-2xl transition-all border border-slate-100"
                      >
                        <ArrowRight size={20} />
                      </button>
                    </div>
                    
                    <div className="space-y-4 flex-1">
                      {pendingTasks.length > 0 ? (
                        pendingTasks.slice(0, 5).map((task) => (
                          <div 
                            key={task.id}
                            onClick={() => setActiveTab('tasks')}
                            className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-white hover:shadow-md hover:border-emerald-100 border border-transparent rounded-2xl transition-all cursor-pointer group/item"
                          >
                            <div className="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center group-hover/item:border-emerald-500 transition-colors shrink-0">
                              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-700 truncate">{task.title}</p>
                              {task.due_date && (
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">
                                  Due: {new Date(task.due_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
                          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500">
                            <CheckCircle2 size={32} strokeWidth={1.5} />
                          </div>
                          <p className="text-sm font-bold text-slate-500 italic">All caught up!</p>
                        </div>
                      )}
                      
                      {pendingTasks.length > 5 && (
                        <button 
                          onClick={() => setActiveTab('tasks')}
                          className="w-full py-4 text-xs font-black text-slate-400 uppercase tracking-[0.2em] hover:text-emerald-600 transition-colors"
                        >
                          + {pendingTasks.length - 5} more tasks
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Section */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                <div className="xl:col-span-1">
                  {hasPermission(currentUser?.role, 'manage_owed_days') && (
                    <OwedDaysManager currentUser={currentUser} users={users} />
                  )}
                </div>
                <div className="xl:col-span-2">
                  <AutomatedSummaryTable 
                    title="MO Automated Daily Summary"
                    allowedShiftCodes={['AM', 'FL', 'PM', 'NS']}
                    users={users}
                    dates={dates}
                    shifts={shifts}
                    shiftTypes={shiftTypes}
                    onDateClick={setSummaryDate}
                    selectedDate={summaryDate}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'roster' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <CalendarIcon size={20} className="text-emerald-500" />
                    Roster Period
                  </h2>
                  <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                      onClick={() => setViewMode('weekly')}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'weekly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Weekly
                    </button>
                    <button
                      onClick={() => setViewMode('monthly')}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => {
                      const next = new Date(viewDate);
                      if (viewMode === 'monthly') {
                        next.setMonth(next.getMonth() - 1);
                      } else {
                        next.setDate(next.getDate() - 7);
                      }
                      setViewDate(next);
                    }}
                    className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="px-4 font-semibold text-slate-700 min-w-[140px] text-center text-sm lg:text-base">
                    {viewMode === 'monthly' 
                      ? viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
                      : `Week of ${getWeekStartDate(viewDate).toLocaleDateString('default', { day: 'numeric', month: 'short' })}`
                    }
                  </span>
                  <button 
                    onClick={() => {
                      const next = new Date(viewDate);
                      if (viewMode === 'monthly') {
                        next.setMonth(next.getMonth() + 1);
                      } else {
                        next.setDate(next.getDate() + 7);
                      }
                      setViewDate(next);
                    }}
                    className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Clock size={16} className="text-emerald-500" />
                    Shift Legend
                  </h2>
                  <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
                    {shiftTypes.map(type => (
                      <div 
                        key={type.code}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black border border-slate-100 flex items-center gap-2 whitespace-nowrap uppercase tracking-tighter"
                        style={{ backgroundColor: type.background_color, color: type.text_color }}
                      >
                        {type.code}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-x-6 gap-y-3 text-[10px] lg:text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> EP: EP Incharge (8am-5pm)</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> AM: Morning (8am-3pm)</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> PM: Afternoon (3pm-10pm)</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> NS: Night (10pm-8am)</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500"></span> PN: Postnight Rest</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-sky-500"></span> FL: Flexi (11am-6pm)</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> WP: Office Hour (8am-5pm)</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-500"></span> HK: Offduty (HK1-4, HKA, HKO)</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-700"></span> CR: Annual Leave</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-700"></span> EL: Emergency Leave</div>
                </div>
              </div>

              <div className="flex flex-col gap-8">
                <AutomatedSummaryTable 
                  title="EP Incharge Roster"
                  allowedShiftCodes={['EP']}
                  users={users}
                  dates={dates}
                  shifts={shifts}
                  shiftTypes={shiftTypes}
                  onDateClick={setSummaryDate}
                  selectedDate={summaryDate}
                />
                <AutomatedSummaryTable 
                  title="MO Automated Daily Summary"
                  allowedShiftCodes={['AM', 'FL', 'PM', 'NS']}
                  users={users}
                  dates={dates}
                  shifts={shifts}
                  shiftTypes={shiftTypes}
                  onDateClick={setSummaryDate}
                  selectedDate={summaryDate}
                />
              </div>

              {canManageRoster(currentUser?.role) ? (
                <AdminRosterTable 
                  users={users}
                  dates={dates}
                  shifts={shifts}
                  shiftTypes={shiftTypes}
                  isAdmin={true}
                  currentUserId={currentUser?.id}
                  onRefresh={fetchShifts}
                  pendingSwaps={swaps}
                  onUpdateShift={async (userId, date, shiftCode, isCodeBlue) => {
                    if (!currentUser) return;
                    try {
                      const res = await fetch('/api/shifts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          user_id: userId,
                          date: date,
                          shift_code: shiftCode || '',
                          is_code_blue: isCodeBlue,
                          changed_by: currentUser.id
                        })
                      });

                      if (res.ok) {
                        await fetchShifts();
                      }
                    } catch (err) {
                      console.error("Failed to update shift", err);
                    }
                  }}
                />
              ) : (
                <StaffDashboardView 
                  users={users}
                  dates={dates}
                  shifts={shifts}
                  shiftTypes={shiftTypes}
                  currentUserId={currentUser?.id || ''}
                  onRefresh={fetchShifts}
                  pendingSwaps={swaps}
                />
              )}

              <div className="max-w-md">
                <OwedDaysManager currentUser={currentUser} users={users} />
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="grid grid-cols-1 gap-6">
              <DocumentLibrary currentUser={currentUser} />
            </div>
          )}

          {activeTab === 'directory' && (
            <div className="grid grid-cols-1 gap-6">
              <StaffDirectory />
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="grid grid-cols-1 gap-6 h-[calc(100vh-160px)]">
              {canManageRoster(currentUser?.role) ? (
                <AdminTaskMonitor currentUser={currentUser} users={users} />
              ) : (
                <StaffTaskList currentUserId={currentUser?.id || ''} />
              )}
            </div>
          )}

          {activeTab === 'profile' && currentUser && (
            <UserProfile 
              currentUser={currentUser as any} 
              onUpdateUser={(updated) => refreshProfile()} 
            />
          )}

          {activeTab === 'swaps' && currentUser && (
            <div className="grid grid-cols-1 gap-6 h-[calc(100vh-160px)]">
              <ShiftSwapManager currentUser={currentUser} onUpdate={fetchShifts} />
            </div>
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-40 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'dashboard' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}
          >
            <LayoutDashboard size={20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('roster')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'roster' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}
          >
            <CalendarIcon size={20} strokeWidth={activeTab === 'roster' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Roster</span>
          </button>
          <button 
            onClick={() => setActiveTab('swaps')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'swaps' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}
          >
            <ArrowRightLeft size={20} strokeWidth={activeTab === 'swaps' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Swaps</span>
          </button>
          <button 
            onClick={() => setActiveTab('docs')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'docs' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}
          >
            <FileText size={20} strokeWidth={activeTab === 'docs' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Docs</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}
          >
            <UserIcon size={20} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Profile</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
