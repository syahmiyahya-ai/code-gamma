import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Shield, 
  Clock, 
  MessageSquare, 
  CheckSquare, 
  ArrowRight, 
  CheckCircle2,
  User as UserIcon
} from 'lucide-react';
import { NoticeBoard } from '../../operational/components/NoticeBoard';
import { AutomatedSummaryTable } from '../components/AutomatedSummaryTable';
import OwedDaysManager from '../components/OwedDaysManager';
import { hasPermission } from '../../../shared/auth/permissions';

interface OverviewTabProps {
  currentUser: any;
  users: any[];
  dailySummary: Record<string, string[]>;
  summaryDate: string;
  pendingTasks: any[];
  setActiveTab: (tab: string) => void;
  dates: Date[];
  shifts: any[];
  shiftTypes: any[];
  setSummaryDate: (date: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  currentUser,
  users,
  dailySummary,
  summaryDate,
  pendingTasks,
  setActiveTab,
  dates,
  shifts,
  shiftTypes,
  setSummaryDate
}) => {
  return (
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
                    {(Object.entries(dailySummary) as [string, string[]][])
                      .filter(([code]) => ['AM', 'FL', 'PM', 'NS', 'WP'].includes(code))
                      .flatMap(([code, names]) => names.map(name => ({ name, code })))
                      .length > 0 ? (
                      (Object.entries(dailySummary) as [string, string[]][])
                        .filter(([code]) => ['AM', 'FL', 'PM', 'NS', 'WP'].includes(code))
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
                onClick={() => setActiveTab('announcements')}
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
  );
};
