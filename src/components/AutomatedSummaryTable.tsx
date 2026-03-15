import React, { useMemo } from 'react';
import { generateDailySummary, ShiftRecord } from '../utils/rosterUtils';
import { Clock } from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: 'Admin' | 'Staff';
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

interface AutomatedSummaryTableProps {
  users: User[];
  dates: Date[];
  shifts: Shift[];
  shiftTypes: ShiftType[];
  onDateClick?: (date: string) => void;
  selectedDate?: string;
  allowedShiftCodes?: string[];
  title?: string;
}

export const AutomatedSummaryTable: React.FC<AutomatedSummaryTableProps> = ({
  users,
  dates,
  shifts,
  shiftTypes,
  onDateClick,
  selectedDate,
  allowedShiftCodes,
  title = "Automated Daily Summary"
}) => {
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Pre-calculate summaries for all dates to avoid repeated filtering in the render loop
  const allSummaries = useMemo(() => {
    const enriched: ShiftRecord[] = shifts.map(s => ({
      doctorName: users.find(u => u.id === s.user_id)?.name || 'Unknown',
      date: s.date,
      shift_code: s.shift_code,
      is_code_blue: s.is_code_blue === 1
    }));

    const summaries: Record<string, Record<string, string[]>> = {};
    dates.forEach(date => {
      const dateStr = formatDate(date);
      summaries[dateStr] = generateDailySummary(enriched, dateStr);
    });
    return summaries;
  }, [shifts, users, dates]);

  // Filter and sort shift types based on the requested sequence: AM, FL, PM, NS
  const filteredShiftTypes = useMemo(() => {
    const sequence = allowedShiftCodes || ['EP', 'AM', 'FL', 'PM', 'NS'];
    return sequence
      .map(code => shiftTypes.find(t => t.code === code))
      .filter((t): t is ShiftType => !!t);
  }, [shiftTypes, allowedShiftCodes]);

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Clock size={18} />
          </div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{title}</h2>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Grouped by Shift Type
        </p>
      </div>

      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full border-separate border-spacing-0 border-t border-l border-slate-300">
          <thead>
            {/* Row 1: TARIKH */}
            <tr className="bg-slate-100">
              <th className="sticky top-0 left-0 z-40 bg-slate-200 p-1 text-center border-b border-r border-slate-300 min-w-[120px] text-[10px] font-bold uppercase tracking-wider">TARIKH</th>
              {dates.map(date => (
                <th key={`s1-${date.toISOString()}`} className="sticky top-0 z-20 bg-slate-100 p-1 text-center border-b border-r border-slate-300 min-w-[100px] text-[10px] font-bold">
                  {date.getDate()}-{date.toLocaleDateString('default', { month: 'short' })}
                </th>
              ))}
            </tr>
            {/* Row 2: HARI */}
            <tr className="bg-slate-100">
              <th className="sticky top-[25px] left-0 z-40 bg-slate-200 p-1 text-center border-b border-r border-slate-300 text-[10px] font-bold uppercase tracking-wider">HARI</th>
              {dates.map(date => (
                <th key={`s2-${date.toISOString()}`} className="sticky top-[25px] z-20 bg-slate-100 p-1 text-center border-b border-r border-slate-300 text-[10px] font-bold">
                  {date.toLocaleDateString('default', { weekday: 'short' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredShiftTypes.map(type => (
              <tr key={type.code} className="hover:bg-slate-50/50 transition-colors">
                <td className="sticky left-0 z-10 p-2 border-b border-r border-slate-300 font-bold text-[10px] uppercase text-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.05)]" style={{ backgroundColor: type.background_color, color: type.text_color }}>
                  <div className="flex flex-col items-center gap-1">
                    <span>{type.code}</span>
                    <div className="w-4 h-0.5 bg-current opacity-30 rounded-full"></div>
                  </div>
                </td>
                {dates.map(date => {
                  const dateStr = formatDate(date);
                  const doctors = allSummaries[dateStr]?.[type.code] || [];
                  const isToday = dateStr === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());

                  return (
                    <td 
                      key={dateStr} 
                      className={`p-1.5 border-b border-r border-slate-300 align-top min-w-[100px] transition-colors ${isToday ? 'bg-blue-50/50' : 'bg-white'}`}
                    >
                      <div className="flex flex-col gap-1">
                        {doctors.length > 0 ? (
                          doctors.map((name, idx) => (
                            <div 
                              key={idx} 
                              className="text-[9px] font-bold text-slate-600 leading-tight py-1 px-2 bg-slate-50 rounded-md border border-slate-100 hover:border-slate-300 transition-colors"
                            >
                              {name}
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center justify-center py-2 opacity-10">
                            <div className="w-4 h-0.5 bg-slate-400 rounded-full"></div>
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
    </div>
  );
};
