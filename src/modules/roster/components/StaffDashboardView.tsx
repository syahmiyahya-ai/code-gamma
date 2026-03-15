import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarDays, Loader2, CheckCircle2 } from 'lucide-react';
import { ShiftSwapModal } from '../../swaps/components/ShiftSwapModal';

interface User {
  id: string;
  name: string;
  role: 'Admin' | 'Staff';
  google_access_token?: string;
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

interface StaffDashboardViewProps {
  users: User[];
  dates: Date[];
  shifts: Shift[];
  shiftTypes: ShiftType[];
  currentUserId: string;
  onRefresh?: () => void;
  pendingSwaps?: any[];
}

export const StaffDashboardView: React.FC<StaffDashboardViewProps> = ({
  users,
  dates,
  shifts,
  shiftTypes,
  currentUserId,
  onRefresh,
  pendingSwaps = []
}) => {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncedIds, setSyncedIds] = useState<number[]>([]);

  const currentUser = useMemo(() => users.find(u => u.id === currentUserId), [users, currentUserId]);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getShift = (userId: string, dateStr: string) => {
    return shifts.find(s => s.user_id === userId && s.date === dateStr);
  };

  const handleSyncCalendar = async (shift: Shift) => {
    if (!shift.id) return;
    setSyncingId(shift.id);
    try {
      const res = await fetch('/api/shifts/sync-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shift.id, user_id: currentUserId })
      });
      if (res.ok) {
        setSyncedIds(prev => [...prev, shift.id!]);
        setTimeout(() => setSyncedIds(prev => prev.filter(id => id !== shift.id)), 3000);
      }
    } catch (err) {
      console.error("Failed to sync calendar", err);
    } finally {
      setSyncingId(null);
    }
  };

  // Get today's date in KL timezone (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }, []);

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Mobile optimized container with smooth scrolling */}
      <div 
        className="overflow-x-auto overflow-y-auto max-h-[75vh] scroll-smooth" 
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50">
              {/* Sticky Top-Left Corner */}
              <th className="sticky top-0 left-0 z-30 bg-slate-50 p-4 text-left border-b border-r border-slate-200 lg:min-w-[180px] min-w-[100px] shadow-[2px_2px_0_rgba(0,0,0,0.05)]">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doctor / Date</div>
              </th>
              {/* Sticky Top Row (Dates) with Today Highlight */}
              {dates.map(date => {
                const dateStr = formatDate(date);
                const isToday = dateStr === todayStr;
                return (
                  <th 
                    key={date.toISOString()} 
                    className={`sticky top-0 z-20 p-4 text-center border-b border-r border-slate-200 min-w-[75px] transition-colors ${isToday ? 'bg-blue-50' : 'bg-slate-50'}`}
                  >
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                      {date.toLocaleDateString('default', { weekday: 'short' })}
                    </div>
                    <div className={`text-sm font-bold ${isToday ? 'text-blue-600' : [0, 6].includes(date.getDay()) ? 'text-rose-500' : 'text-slate-700'}`}>
                      {date.getDate()}
                    </div>
                    {isToday && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"></div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const isCurrentUser = user.id === currentUserId;
              return (
                <tr 
                  key={user.id} 
                  className={`transition-colors ${isCurrentUser ? 'bg-yellow-50/80 hover:bg-yellow-100/80' : 'hover:bg-slate-50/50'}`}
                >
                  {/* Sticky First Column (Doctors) with Self Highlight */}
                  <td className={`sticky left-0 z-10 p-2 lg:p-4 border-b border-r border-slate-200 font-medium shadow-[2px_0_0_rgba(0,0,0,0.05)] transition-colors ${isCurrentUser ? 'bg-yellow-50 text-yellow-900' : 'bg-white text-slate-700'}`}>
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center text-[10px] lg:text-xs font-bold ${isCurrentUser ? 'bg-yellow-200 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] lg:text-sm font-bold truncate max-w-[60px] lg:max-w-[120px]">{user.name}</p>
                        {isCurrentUser && (
                          <div className="flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-yellow-500 animate-pulse"></span>
                            <p className="text-[7px] lg:text-[8px] font-black text-yellow-600 uppercase tracking-tighter">Me</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Data Cells with Today Highlight */}
                  {dates.map(date => {
                    const dateStr = formatDate(date);
                    const shift = getShift(user.id, dateStr);
                    const type = shiftTypes.find(t => t.code === shift?.shift_code);
                    const isToday = dateStr === todayStr;

                    const hasPendingSwap = pendingSwaps.some(s => 
                      (s.requester_id === user.id && s.requester_shift_date === dateStr) ||
                      (s.target_user_id === user.id && s.target_shift_date === dateStr)
                    );

                    const canSwap = isCurrentUser && shift && !['HK1', 'HK2', 'HK3', 'HK4', 'HKA', 'HKO', 'CR', 'EL'].includes(shift.shift_code);
                    const canSync = isCurrentUser && shift && currentUser?.google_access_token;

                    return (
                      <td 
                        key={dateStr} 
                        className={`p-2 border-b border-r border-slate-100 text-center transition-all relative group ${isToday ? 'bg-blue-50/30' : ''}`}
                      >
                        <div 
                          className={`h-10 w-full rounded-lg flex items-center justify-center text-xs font-bold transition-transform ${!shift ? 'border-2 border-dashed border-slate-100' : ''} ${hasPendingSwap ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                          style={type ? { backgroundColor: type.background_color, color: type.text_color } : {}}
                        >
                          {shift?.shift_code || ''}
                          
                          {hasPendingSwap && (
                            <div className="absolute top-1 left-1 text-amber-500 animate-pulse" title="Pending Swap Request">
                              <ArrowRightLeft size={10} strokeWidth={3} />
                            </div>
                          )}

                          {(canSwap || canSync) && (
                            <div className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-1 z-20">
                              {canSwap && (
                                <button
                                  onClick={() => {
                                    setSelectedShift(shift);
                                    setIsSwapModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                                  title="Request Swap"
                                >
                                  <ArrowRightLeft size={12} />
                                  <span className="text-[8px] font-black uppercase tracking-tighter">Swap</span>
                                </button>
                              )}
                              {canSync && (
                                <button
                                  onClick={() => handleSyncCalendar(shift)}
                                  disabled={syncingId === shift.id}
                                  className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                                  title="Sync to Google Calendar"
                                >
                                  {syncingId === shift.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : syncedIds.includes(shift.id!) ? (
                                    <CheckCircle2 size={12} className="text-emerald-400" />
                                  ) : (
                                    <CalendarDays size={12} />
                                  )}
                                  <span className="text-[8px] font-black uppercase tracking-tighter">
                                    {syncedIds.includes(shift.id!) ? 'Synced' : 'Sync'}
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {shift?.is_code_blue === 1 && (
                          <div className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-sm"></div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedShift && (
        <ShiftSwapModal
          isOpen={isSwapModalOpen}
          onClose={() => setIsSwapModalOpen(false)}
          requesterShift={selectedShift}
          users={users}
          allShifts={shifts}
          currentUserId={currentUserId}
          onSuccess={() => onRefresh?.()}
        />
      )}
    </div>
  );
};
