import React, { useEffect, useRef, useState, useMemo } from 'react';
import { format, addDays, startOfMonth, endOfMonth, isSameDay, isFuture, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Users, 
  Clock, 
  ArrowRightLeft, 
  FileText, 
  X, 
  ChevronRight,
  Info,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  name: string;
  role: string;
  avatar_url?: string;
}

interface ShiftType {
  code: string;
  background_color: string;
  text_color: string;
  start_time?: string;
  end_time?: string;
}

interface Shift {
  id?: number;
  user_id: string;
  date: string;
  shift_code: string;
  is_code_blue: number;
}

interface MatrixRosterViewProps {
  currentUserId: string;
  users: User[];
  shiftTypes: ShiftType[];
  shifts: Shift[];
  viewDate: Date;
}

const TIMEZONE = 'Asia/Kuala_Lumpur';

export const MatrixRosterView: React.FC<MatrixRosterViewProps> = ({
  currentUserId,
  users,
  shiftTypes,
  shifts,
  viewDate
}) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLTableHeaderCellElement>(null);
  
  const [selectedShift, setSelectedShift] = useState<{
    date: Date;
    shiftCode: string;
    team: User[];
    type: ShiftType;
  } | null>(null);
  const [showSwapSelect, setShowSwapSelect] = useState(false);

  // 1. Determine Today's Date in KL Timezone
  const today = useMemo(() => toZonedTime(new Date(), TIMEZONE), []);
  const todayStr = format(today, 'yyyy-MM-dd');

  // 2. Generate Dates for the Month
  const dates = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    const days = [];
    let curr = start;
    while (curr <= end) {
      days.push(curr);
      curr = addDays(curr, 1);
    }
    return days;
  }, [viewDate]);

  // 3. Auto-scroll to Today
  useEffect(() => {
    if (todayRef.current && containerRef.current) {
      const container = containerRef.current;
      const todayEl = todayRef.current;
      
      const scrollPos = todayEl.offsetLeft - (container.offsetWidth / 2) + (todayEl.offsetWidth / 2);
      container.scrollTo({
        left: scrollPos,
        behavior: 'smooth'
      });
    }
  }, [dates]);

  // 4. Group shifts by date and shift code
  const matrixData = useMemo(() => {
    const data: Record<string, Record<string, User[]>> = {};
    
    shifts.forEach(shift => {
      const dateStr = shift.date;
      const code = shift.shift_code;
      const user = users.find(u => u.id === shift.user_id);
      
      if (user) {
        if (!data[code]) data[code] = {};
        if (!data[code][dateStr]) data[code][dateStr] = [];
        data[code][dateStr].push(user);
      }
    });
    
    return data;
  }, [shifts, users]);

  const handleCellClick = (date: Date, shiftCode: string, team: User[]) => {
    const isUserInShift = team.some(u => u.id === currentUserId);
    const isFutureDate = isFuture(date) || isSameDay(date, today);
    
    if (isUserInShift && isFutureDate) {
      const type = shiftTypes.find(t => t.code === shiftCode);
      if (type) {
        setSelectedShift({ date, shiftCode, team, type });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Table Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <table className="border-separate border-spacing-0 w-full min-w-max">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-50 bg-white border-b border-r border-slate-200 p-4 text-left min-w-[100px]">
                <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                  <Clock size={14} />
                  Shift
                </div>
              </th>
              {dates.map(date => {
                const isToday = isSameDay(date, today);
                return (
                  <th 
                    key={date.toISOString()}
                    ref={isToday ? todayRef : null}
                    className={`sticky top-0 z-40 border-b border-r border-slate-200 p-3 text-center transition-colors ${
                      isToday ? 'bg-blue-50' : 'bg-white'
                    }`}
                  >
                    <div className={`text-[10px] font-black uppercase tracking-tighter ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                      {format(date, 'EEE')}
                    </div>
                    <div className={`text-lg font-black leading-none mt-1 ${isToday ? 'text-blue-700' : 'text-slate-800'}`}>
                      {format(date, 'dd')}
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">
                      {format(date, 'MMM')}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shiftTypes.map((type) => (
              <tr key={type.code} className="group">
                <td className="sticky left-0 z-30 bg-white border-b border-r border-slate-200 p-4">
                  <div 
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-[11px] font-black shadow-sm"
                    style={{ backgroundColor: type.background_color, color: type.text_color }}
                  >
                    {type.code}
                  </div>
                </td>
                {dates.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const team = matrixData[type.code]?.[dateStr] || [];
                  const isToday = isSameDay(date, today);
                  const hasCurrentUser = team.some(u => u.id === currentUserId);

                  return (
                    <td 
                      key={`${type.code}-${dateStr}`}
                      onClick={() => handleCellClick(date, type.code, team)}
                      className={`border-b border-r border-slate-200 p-2 min-w-[140px] align-top transition-all cursor-pointer hover:bg-slate-100/50 ${
                        isToday ? 'bg-blue-50/30' : 'bg-white'
                      }`}
                    >
                      <div className="flex flex-col gap-1.5">
                        {team.map(member => (
                          <div 
                            key={member.id}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all truncate ${
                              member.id === currentUserId 
                                ? 'bg-yellow-200 text-yellow-900 ring-1 ring-yellow-400 shadow-sm scale-105 z-10' 
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {member.name}
                          </div>
                        ))}
                        {team.length === 0 && (
                          <div className="h-6 flex items-center justify-center">
                            <div className="w-1 h-1 bg-slate-200 rounded-full" />
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Shift Detail Modal / Bottom Sheet */}
      <AnimatePresence>
        {selectedShift && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedShift(null);
                setShowSwapSelect(false);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-8 pb-4 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div 
                      className="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest"
                      style={{ backgroundColor: selectedShift.type.background_color, color: selectedShift.type.text_color }}
                    >
                      {selectedShift.shiftCode} Shift
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {format(selectedShift.date, 'EEEE, dd MMMM')}
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Shift Details</h3>
                </div>
                <button 
                  onClick={() => {
                    setSelectedShift(null);
                    setShowSwapSelect(false);
                  }}
                  className="p-2 bg-slate-100 text-slate-400 rounded-full hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 pt-0 space-y-8">
                {/* Time Info */}
                <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-emerald-500">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Working Hours</p>
                    <p className="text-lg font-black text-slate-700">
                      {selectedShift.type.start_time || '08:00'} - {selectedShift.type.end_time || '17:00'}
                    </p>
                  </div>
                </div>

                {/* Team Members */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Team Members</h4>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md">
                      {selectedShift.team.length} Active
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedShift.team.map(member => (
                      <div 
                        key={member.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          member.id === currentUserId 
                            ? 'bg-yellow-50 border-yellow-200' 
                            : 'bg-white border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users size={14} className="text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className={`text-xs font-bold ${member.id === currentUserId ? 'text-yellow-900' : 'text-slate-700'}`}>
                              {member.name} {member.id === currentUserId && '(You)'}
                            </p>
                            <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{member.role}</p>
                          </div>
                        </div>
                        {member.id !== currentUserId && (
                          <ChevronRight size={14} className="text-slate-300" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-4 pt-4">
                  {!showSwapSelect ? (
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setShowSwapSelect(true)}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-white border-2 border-slate-100 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                      >
                        <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          <ArrowRightLeft size={20} />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Request Swap</span>
                      </button>

                      <button 
                        onClick={() => {
                          const dateStr = format(selectedShift.date, 'yyyy-MM-dd');
                          navigate(`/intranet?action=leave&date=${dateStr}`);
                          setSelectedShift(null);
                        }}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-white border-2 border-slate-100 rounded-3xl hover:border-rose-500 hover:bg-rose-50 transition-all group"
                      >
                        <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-rose-500 group-hover:text-white transition-all">
                          <FileText size={20} />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Apply Leave</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Select Colleague to Swap</h4>
                        <button onClick={() => setShowSwapSelect(false)} className="text-emerald-600 hover:text-emerald-800">
                          <X size={16} />
                        </button>
                      </div>
                      <select 
                        className="w-full p-3 bg-white border border-emerald-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                        onChange={async (e) => {
                          const targetId = e.target.value;
                          if (!targetId) return;
                          
                          try {
                            // Find the shift ID for the current user on this date
                            const userShift = shifts.find(s => s.user_id === currentUserId && s.date === format(selectedShift.date, 'yyyy-MM-dd'));
                            if (!userShift?.id) throw new Error('Shift not found');

                            const res = await fetch('/api/shift-swaps', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                requester_id: currentUserId,
                                requester_shift_id: userShift.id,
                                target_user_id: targetId,
                                reason: `Swap request for ${selectedShift.shiftCode} shift on ${format(selectedShift.date, 'dd MMM')}`
                              })
                            });
                            
                            if (res.ok) {
                              alert('Swap request sent successfully!');
                              setSelectedShift(null);
                            } else {
                              const err = await res.json();
                              alert(`Failed to send request: ${err.error}`);
                            }
                          } catch (err) {
                            console.error(err);
                            alert('An error occurred while sending the request.');
                          }
                        }}
                      >
                        <option value="">Choose a colleague...</option>
                        {users.filter(u => u.id !== currentUserId).map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                      <p className="text-[9px] text-emerald-600 font-medium">
                        The colleague will receive a notification to accept or decline your request.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
                <Info size={14} className="text-slate-400" />
                <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                  Changes to this shift must be approved by the Department Manager. Swaps are only valid once accepted by the target colleague.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
