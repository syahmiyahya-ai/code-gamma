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
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50">
              {/* Sticky Top-Left Corner */}
              <th className="sticky top-0 left-0 z-30 bg-slate-50 p-4 text-left border-b border-r border-slate-200 min-w-[150px] shadow-[2px_2px_0_rgba(0,0,0,0.05)]">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shift / Date</div>
              </th>
              {/* Sticky Top Row (Dates) */}
              {dates.map(date => {
                const dateStr = formatDate(date);
                const isSelected = selectedDate === dateStr;
                return (
                  <th 
                    key={date.toISOString()} 
                    onClick={() => onDateClick?.(dateStr)}
                    className={`sticky top-0 z-20 p-4 text-center border-b border-r border-slate-200 min-w-[120px] cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50' : 'bg-slate-50 hover:bg-slate-100'}`}
                  >
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                      {date.toLocaleDateString('default', { weekday: 'short' })}
                    </div>
                    <div className={`text-sm font-bold ${[0, 6].includes(date.getDay()) ? 'text-rose-500' : 'text-slate-700'}`}>
                      {date.getDate()}
                    </div>
                    {isSelected && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredShiftTypes.map(type => (
              <tr key={type.code} className="hover:bg-slate-50/50 transition-colors">
                {/* Sticky First Column (Shift Codes) */}
                <td className="sticky left-0 z-10 bg-white p-4 border-b border-r border-slate-200 font-medium text-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-sm border border-slate-100"
                      style={{ backgroundColor: type.background_color, color: type.text_color }}
                    >
                      {type.code}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{type.code} Shift</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase">Assignments</p>
                    </div>
                  </div>
                </td>
                {/* Data Cells (Doctor Lists) */}
                {dates.map(date => {
                  const dateStr = formatDate(date);
                  const doctors = allSummaries[dateStr]?.[type.code] || [];

                  return (
                    <td 
                      key={dateStr} 
                      className="p-3 border-b border-r border-slate-100 align-top min-w-[120px]"
                    >
                      <div className="flex flex-col gap-1.5">
                        {doctors.length > 0 ? (
                          doctors.map((name, idx) => {
                            // Find if this specific doctor on this date/shift is code blue
                            const isCodeBlue = shifts.find(s => 
                              s.date === dateStr && 
                              s.shift_code === type.code && 
                              users.find(u => u.name === name)?.id === s.user_id &&
                              s.is_code_blue === 1
                            );

                            return (
                              <div 
                                key={idx} 
                                className={`p-2 rounded-lg border text-[10px] font-bold transition-all flex flex-col gap-1 ${isCodeBlue ? 'bg-rose-50 border-rose-100 text-rose-700 shadow-sm' : 'bg-white border-slate-100 text-slate-600 shadow-sm'}`}
                              >
                                <span className="truncate">{name}</span>
                                {isCodeBlue && (
                                  <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-rose-500">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                    Code Blue
                                  </span>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-[10px] text-slate-300 italic text-center py-2">—</span>
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
