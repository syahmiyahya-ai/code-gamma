import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { generateDailySummary, ShiftRecord } from '../utils/rosterUtils';
import { AdminRosterTable } from '../components/AdminRosterTable';
import { AutomatedSummaryTable } from '../components/AutomatedSummaryTable';
import { StaffDashboardView } from '../components/StaffDashboardView';
import { useAuth } from '../contexts/AuthContext';
import { canManageRoster, UserRole } from '../utils/permissions';
import { MatrixRosterView } from '../components/MatrixRosterView';
import { fetchWithRetry } from '../utils/api';

interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
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

export const RosterPage: React.FC = () => {
  const { profile } = useAuth();
  console.log('[ROSTER] Current user role:', profile?.role);
  
  const [users, setUsers] = useState<User[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('monthly');
  const [swaps, setSwaps] = useState<any[]>([]);
  const [summaryDate, setSummaryDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date()));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const start = formatDate(viewMode === 'monthly' ? getStartDate(viewDate) : getWeekStartDate(viewDate));
        const end = formatDate(viewMode === 'monthly' ? getEndDate(viewDate) : getWeekEndDate(viewDate));

        const [usersRes, typesRes, swapsRes, shiftsRes] = await Promise.all([
          fetchWithRetry(`/api/users`),
          fetchWithRetry(`/api/shift-types`),
          fetchWithRetry(`/api/shift-swaps?status=PENDING`),
          fetchWithRetry(`/api/shifts?start=${start}&end=${end}`)
        ]);
        
        if (!usersRes.ok || !typesRes.ok || !swapsRes.ok || !shiftsRes.ok) {
          throw new Error(`Roster data fetch failed`);
        }

        const [usersData, typesData, swapsData, shiftsData] = await Promise.all([
          usersRes.json(),
          typesRes.json(),
          swapsRes.json(),
          shiftsRes.json()
        ]);

        setUsers(usersData);
        setShiftTypes(typesData);
        setSwaps(swapsData);
        setShifts(shiftsData);
      } catch (err) {
        console.error("Failed to fetch roster data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const fetchShifts = async () => {
    try {
      const start = formatDate(viewMode === 'monthly' ? getStartDate(viewDate) : getWeekStartDate(viewDate));
      const end = formatDate(viewMode === 'monthly' ? getEndDate(viewDate) : getWeekEndDate(viewDate));
      const res = await fetchWithRetry(`/api/shifts?start=${start}&end=${end}`);
      if (!res.ok) throw new Error(`Fetch shifts failed: ${res.status}`);
      const data = await res.json();
      setShifts(data);
    } catch (err) {
      console.error("Error fetching shifts:", err);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [viewDate, viewMode]);

  function getStartDate(date: Date) {
    const d = new Date(date);
    d.setDate(1);
    return d;
  }

  function getEndDate(date: Date) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d;
  }

  function getWeekStartDate(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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

  if (loading) return <div className="p-8 text-center">Loading Roster...</div>;

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
              if (viewMode === 'monthly') next.setMonth(next.getMonth() - 1);
              else next.setDate(next.getDate() - 7);
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
              if (viewMode === 'monthly') next.setMonth(next.getMonth() + 1);
              else next.setDate(next.getDate() + 7);
              setViewDate(next);
            }}
            className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 text-slate-600">
          <AlertCircle size={18} className="text-rose-500" />
          <p className="text-xs font-medium">
            The <span className="inline-block w-2 h-2 bg-rose-500 rounded-full"></span> red dot indicates <span className="font-bold text-rose-600">Code Blue Duty</span> for that shift.
          </p>
        </div>
      </div>

      {canManageRoster(profile?.role) ? (
        <AdminRosterTable 
          users={users}
          dates={dates}
          shifts={shifts}
          shiftTypes={shiftTypes}
          isAdmin={true}
          currentUserId={profile?.id}
          onRefresh={fetchShifts}
          pendingSwaps={swaps}
          onUpdateShift={async (userId, date, shiftCode, isCodeBlue) => {
            try {
              await fetchWithRetry('/api/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, date, shift_code: shiftCode, is_code_blue: isCodeBlue ? 1 : 0, changed_by: profile?.id })
              });
              fetchShifts();
            } catch (err) {
              console.error("Error updating shift", err);
            }
          }}
        />
      ) : (
        <MatrixRosterView 
          users={users}
          shiftTypes={shiftTypes}
          shifts={shifts}
          currentUserId={profile?.id || ''}
          viewDate={viewDate}
        />
      )}

      <div className="flex flex-col gap-8">
        <AutomatedSummaryTable 
          title="Roster By Shift"
          allowedShiftCodes={['AM', 'FL', 'PM', 'NS']}
          users={users}
          dates={dates}
          shifts={shifts}
          shiftTypes={shiftTypes}
          onDateClick={setSummaryDate}
          selectedDate={summaryDate}
        />
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
      </div>
    </div>
  );
};
