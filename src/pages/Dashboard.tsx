import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  LayoutDashboard,
  ListTodo,
  ArrowRightLeft,
  User as UserIcon,
  Users,
  Shield,
  MessageSquare,
  CheckSquare,
  ArrowRight,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateDailySummary, ShiftRecord } from '../modules/roster/utils/rosterUtils';
import { AdminRosterTable } from '../modules/roster/components/AdminRosterTable';
import { AutomatedSummaryTable } from '../modules/roster/components/AutomatedSummaryTable';
import { StaffDashboardView } from '../modules/roster/components/StaffDashboardView';
import { DocumentLibrary } from '../modules/operational/components/DocumentLibrary';
import StaffDirectory from '../modules/staff/components/StaffDirectory';
import { UserProfile } from '../modules/staff/components/UserProfile';
import { ShiftSwapManager } from '../modules/swaps/components/ShiftSwapManager';
import OwedDaysManager from '../modules/roster/components/OwedDaysManager';
import { useAuth } from '../shared/auth/AuthContext';
import { useDashboardData } from '../modules/roster/hooks/useDashboardData';
import { Sidebar } from '../shared/components/Layout/Sidebar';
import { Header } from '../shared/components/Layout/Header';
import { OverviewTab } from '../modules/roster/components/OverviewTab';
import AdminTaskMonitor from '../modules/tasks/components/AdminTaskMonitor';
import StaffTaskList from '../modules/tasks/components/StaffTaskList';

import { 
  hasPermission,
  canManageRoster
} from '../shared/auth/permissions';
import { getStartDate, getEndDate, getWeekStartDate } from '../shared/utils/dateUtils';

// --- Constants ---
const SHIFT_CODES = ['EP', 'AM', 'PM', 'NS', 'PN', 'FL', 'WP', 'HK1', 'HK2', 'HK3', 'HK4', 'HKA', 'HKO', 'CR', 'EL'];

export const Dashboard = () => {
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [viewDate, setViewDate] = useState(new Date());

  const {
    users,
    shifts,
    shiftTypes,
    tasks,
    swaps,
    loading,
    error,
    fetchShifts,
    summaryDate,
    setSummaryDate,
    dailySummary
  } = useDashboardData(profile?.id || null);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const dates = useMemo(() => {
    if (viewMode === 'monthly') {
      const start = getStartDate(viewDate);
      const end = getEndDate(viewDate);
      const days = [];
      let curr = new Date(start);
      while (curr <= end) {
        days.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
      }
      return days;
    } else {
      const start = getWeekStartDate(viewDate);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return d;
      });
    }
  }, [viewMode, viewDate]);

  const renderTabContent = () => {
    if (!profile) return null;

    switch (activeTab) {
      case 'dashboard':
        return (
          <OverviewTab
            currentUser={profile}
            users={users}
            dailySummary={dailySummary}
            summaryDate={summaryDate}
            pendingTasks={tasks.filter(t => t.status === 'pending')}
            onTabChange={setActiveTab}
            shifts={shifts}
            shiftTypes={shiftTypes}
            dates={dates}
            setSummaryDate={setSummaryDate}
          />
        );
      case 'roster':
        return (
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

            {canManageRoster(profile.role) ? (
              <AdminRosterTable 
                users={users}
                dates={dates}
                shifts={shifts}
                shiftTypes={shiftTypes}
                isAdmin={true}
                currentUserId={profile.id}
                onRefresh={fetchShifts}
                pendingSwaps={swaps}
                onUpdateShift={async (userId, date, shiftCode, isCodeBlue) => {
                  try {
                    const res = await fetch('/api/shifts', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        user_id: userId,
                        date: date,
                        shift_code: shiftCode || '',
                        is_code_blue: isCodeBlue,
                        changed_by: profile.id
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
                currentUserId={profile.id}
                onRefresh={fetchShifts}
                pendingSwaps={swaps}
              />
            )}

            <div className="max-w-md">
              <OwedDaysManager currentUser={profile} users={users} />
            </div>
          </div>
        );
      case 'docs':
        return <DocumentLibrary currentUser={profile} />;
      case 'directory':
        return <StaffDirectory />;
      case 'tasks':
        return canManageRoster(profile.role) ? (
          <AdminTaskMonitor currentUser={profile} users={users} />
        ) : (
          <StaffTaskList currentUserId={profile.id} />
        );
      case 'profile':
        return <UserProfile currentUser={profile as any} onUpdateUser={refreshProfile} />;
      case 'swaps':
        return <ShiftSwapManager currentUser={profile} onUpdate={fetchShifts} />;
      default:
        return null;
    }
  };

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

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col lg:flex-row">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        user={profile} 
        onLogout={handleLogout} 
      />

      <div className="flex-1 flex flex-col min-h-screen">
        <Header user={profile} onLogout={handleLogout} />

        <main className="max-w-[1600px] w-full mx-auto p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
          {renderTabContent()}
        </main>
        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-6 py-3 z-50 flex items-center justify-between shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Home' },
            { id: 'roster', icon: <CalendarIcon size={20} />, label: 'Roster' },
            { id: 'tasks', icon: <ListTodo size={20} />, label: 'Tasks' },
            { id: 'swaps', icon: <ArrowRightLeft size={20} />, label: 'Swaps' },
            { id: 'profile', icon: <UserIcon size={20} />, label: 'Me' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === item.id ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${
                activeTab === item.id ? 'bg-emerald-50' : 'bg-transparent'
              }`}>
                {item.icon}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};
