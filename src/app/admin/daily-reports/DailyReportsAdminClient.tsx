'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Users, FileSpreadsheet, CheckCircle2, 
  XCircle, Search, RefreshCw, ChevronRight, ClipboardList, Loader2
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { getAllDailyReports, getActiveEmployees, getSubmissionStatus, exportDailyReportsExcel } from './actions';

interface EmployeeFilter {
  id: string;
  name: string;
}

interface ReportItem {
  id: string;
  employee_id: string;
  profile_id: string;
  report_date: string;
  applications_count: number;
  interviews_count: number;
  assessments: number;
  technical_rounds: number;
  non_technical: number;
  self_submissions: number;
  support_submissions: number;
  created_at: string;
  employee: {
    id: string;
    name: string;
  } | null;
  profile: {
    id: string;
    client_name: string;
    created_at: string;
  } | null;
}

interface SubmissionStatus {
  id: string;
  name: string;
  department: string;
  designation: string;
  submitted: boolean;
}

interface DailyReportsAdminClientProps {
  initialDate: string;
  initialReports: ReportItem[];
  initialEmployees: EmployeeFilter[];
  initialSubmissionStatus: SubmissionStatus[];
}

export default function DailyReportsAdminClient({
  initialDate,
  initialReports,
  initialEmployees,
  initialSubmissionStatus
}: DailyReportsAdminClientProps) {
  const { toast } = useToast();
  const [date, setDate] = useState(initialDate);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [reports, setReports] = useState<ReportItem[]>(initialReports);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus[]>(initialSubmissionStatus);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const todayISTStr = useMemo(() => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    return ist.toISOString().split('T')[0];
  }, []);

  // Fetch updated data when filters change
  useEffect(() => {
    const updateData = async () => {
      setLoading(true);
      try {
        const updatedReports = await getAllDailyReports(date, selectedEmployee);
        const updatedStatus = await getSubmissionStatus(date);
        setReports(updatedReports as any);
        setSubmissionStatus(updatedStatus);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load daily reports data.');
      } finally {
        setLoading(false);
      }
    };

    // Skip initial load as it's already fetched on server
    if (date !== initialDate || selectedEmployee !== 'all') {
      updateData();
    }
  }, [date, selectedEmployee, initialDate, toast]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await exportDailyReportsExcel(date, selectedEmployee);
      
      if (res && res.url) {
        const a = document.createElement('a');
        a.href = res.url;
        a.download = `Daily_Recruitment_Reports_${date}${selectedEmployee !== 'all' ? `_Emp_${selectedEmployee}` : ''}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('Excel report downloaded successfully!');
      } else {
        throw new Error('No URL returned from server');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to export daily reports to Excel.');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
  };

  // Group reports by employee
  const groupedReports: Record<string, { employeeName: string; items: ReportItem[] }> = {};
  reports.forEach(report => {
    const empId = report.employee_id;
    const empName = report.employee?.name || 'Unknown Employee';
    if (!groupedReports[empId]) {
      groupedReports[empId] = {
        employeeName: empName,
        items: []
      };
    }
    groupedReports[empId].items.push(report);
  });

  // Totals calculations
  let grandTotalApps = 0;
  let grandTotalInts = 0;
  let grandTotalAssess = 0;
  let grandTotalTech = 0;
  let grandTotalNonTech = 0;
  let grandTotalSelf = 0;
  let grandTotalSupp = 0;

  reports.forEach(r => {
    grandTotalApps += r.applications_count;
    grandTotalInts += r.interviews_count;
    grandTotalAssess += r.assessments;
    grandTotalTech += r.technical_rounds;
    grandTotalNonTech += r.non_technical;
    grandTotalSelf += r.self_submissions;
    grandTotalSupp += r.support_submissions;
  });

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-lg border border-zinc-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary-500" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Daily Recruitment Reports</h1>
          </div>
          <p className="text-xs text-zinc-450">
            View, track submission status, and export daily metrics from employees.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleExportExcel}
            disabled={exporting || reports.length === 0}
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50/60 bg-white cursor-pointer min-h-[40px] text-xs font-bold transition-colors duration-200"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export to Excel</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main layout split (left details, right tracker sidebar) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Main metrics panel */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Filters Card */}
          <Card className="p-4 rounded-lg border border-zinc-200 shadow-2xs bg-white" hover={false}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Date Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-navy-900">Select Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                  <input
                    type="date"
                    value={date}
                    max={todayISTStr}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-xs font-semibold text-navy-900 cursor-pointer bg-white"
                  />
                </div>
              </div>

              {/* Employee Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-navy-900">Filter By Employee</label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-xs font-semibold text-navy-900 cursor-pointer bg-white"
                  >
                    <option value="all">All Employees</option>
                    {initialEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary Stats Overview */}
              <div className="sm:col-span-2 md:col-span-1 flex items-center justify-end">
                <div className="w-full bg-zinc-50 border border-zinc-200 rounded-md p-3 flex justify-between items-center">
                  <div className="text-left">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Total Submissions Today</span>
                    <h4 className="text-lg font-extrabold text-navy-900 mt-0.5 font-mono">
                      {submissionStatus.filter(s => s.submitted).length} / {submissionStatus.length}
                    </h4>
                  </div>
                  <div className="h-8 w-1 bg-primary-500 rounded-full" />
                </div>
              </div>
            </div>
          </Card>

          {/* Reports Table Area */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs overflow-hidden min-h-[300px] relative">
            {loading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                  <span className="text-xs font-semibold text-navy-800">Refreshing records...</span>
                </div>
              </div>
            )}

            {reports.length === 0 ? (
              <div className="text-center py-20">
                <ClipboardList className="w-12 h-12 text-zinc-400 mx-auto mb-3 opacity-25" />
                <h4 className="text-sm font-bold text-navy-900">No Reports Found</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                  There are no daily metrics reports submitted for the selected criteria on this date.
                </p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest select-none">
                  <span>Employee Metrics Matrix</span>
                  <span className="flex items-center gap-1 text-primary-500 font-semibold tracking-wider normal-case animate-pulse">
                    ↔ Swipe horizontally to view all columns
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-zinc-50 text-zinc-650 border-b border-zinc-200 select-none">
                        <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[10px]">Assign Date</th>
                        <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[10px]">Consultant Name</th>
                        <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[10px] text-center w-28 bg-zinc-100/50">Apps Count</th>
                        <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[10px] text-center w-28 bg-zinc-100/50">Interviews</th>
                        <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[10px] text-center w-28">Assessments</th>
                        <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[10px] text-center w-28">Tech Rounds</th>
                        <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[10px] text-center w-28">Non-Tech</th>
                        <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[10px] text-center w-28 bg-primary-50/50 text-primary-750 font-bold">Self (Own)</th>
                        <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[10px] text-center w-28 bg-primary-50/50 text-primary-750 font-bold">Support</th>
                      </tr>
                    </thead>

                  {Object.entries(groupedReports).map(([empId, group]) => {
                    let empApps = 0;
                    let empInts = 0;
                    let empAssess = 0;
                    let empTech = 0;
                    let empNonTech = 0;
                    let empSelf = 0;
                    let empSupp = 0;

                    group.items.forEach(r => {
                      empApps += r.applications_count;
                      empInts += r.interviews_count;
                      empAssess += r.assessments;
                      empTech += r.technical_rounds;
                      empNonTech += r.non_technical;
                      empSelf += r.self_submissions;
                      empSupp += r.support_submissions;
                    });

                    return (
                      <tbody key={empId} className="divide-y divide-zinc-150 border-b border-zinc-200 last:border-b-0">
                        {/* Employee Section Header Row */}
                        <tr className="bg-zinc-50/95 border-b border-zinc-200">
                          <td colSpan={9} className="p-2.5 font-semibold text-navy-900 uppercase tracking-wider text-xs border-l-4 border-primary-500">
                            <div className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-primary-500" />
                              <span>{group.employeeName}</span>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Profile Metric Rows */}
                        {group.items.map(item => {
                          const pDate = item.profile?.created_at 
                            ? formatDate(item.profile.created_at) 
                            : '—';
                          const cName = item.profile?.client_name || 'Deleted Consultant';

                          return (
                            <tr key={item.id} className="hover:bg-zinc-50/30 transition-colors duration-150">
                              <td className="p-3 text-zinc-500 font-mono whitespace-nowrap text-xs font-normal">{pDate}</td>
                              <td className="p-3 font-semibold text-navy-900 font-sans text-xs uppercase tracking-wider">{cName}</td>
                              <td className="p-3 text-center bg-zinc-50/30 font-mono font-semibold text-navy-900 text-xs">{item.applications_count}</td>
                              <td className="p-3 text-center bg-zinc-50/30 font-mono font-semibold text-navy-900 text-xs">{item.interviews_count}</td>
                              <td className="p-3 text-center font-mono font-semibold text-navy-900 text-xs">{item.assessments}</td>
                              <td className="p-3 text-center font-mono font-semibold text-navy-900 text-xs">{item.technical_rounds}</td>
                              <td className="p-3 text-center font-mono font-semibold text-navy-900 text-xs">{item.non_technical}</td>
                              <td className="p-3 text-center bg-primary-50/30 font-mono font-bold text-primary-800 text-xs">{item.self_submissions}</td>
                              <td className="p-3 text-center bg-primary-50/30 font-mono font-bold text-primary-800 text-xs">{item.support_submissions}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    );
                  })}

                  {/* Table Grand Summary Row */}
                  {Object.keys(groupedReports).length > 1 && (
                    <tbody className="border-t-2 border-primary-300">
                      <tr className="bg-gradient-to-r from-primary-50/30 to-primary-50/60 font-bold text-xs hover:from-primary-50/40 hover:to-primary-50/80 transition-colors duration-150">
                        <td className="p-3 text-primary-900 rounded-bl-lg uppercase tracking-wider text-xs font-bold">GRAND TOTAL</td>
                        <td className="p-3 text-primary-900 text-xs font-bold">ALL SELECTED</td>
                        <td className="p-3 text-center bg-primary-50/40 font-mono font-bold text-navy-950 text-xs">{grandTotalApps}</td>
                        <td className="p-3 text-center bg-primary-50/40 font-mono font-bold text-navy-950 text-xs">{grandTotalInts}</td>
                        <td className="p-3 text-center font-mono font-bold text-navy-950 text-xs">{grandTotalAssess}</td>
                        <td className="p-3 text-center font-mono font-bold text-navy-950 text-xs">{grandTotalTech}</td>
                        <td className="p-3 text-center font-mono font-bold text-navy-950 text-xs">{grandTotalNonTech}</td>
                        <td className="p-3 text-center bg-primary-50/30 font-mono font-bold text-primary-900 text-xs">{grandTotalSelf}</td>
                        <td className="p-3 text-center bg-primary-50/30 font-mono font-bold text-primary-900 rounded-br-lg text-xs">{grandTotalSupp}</td>
                      </tr>
                    </tbody>
                  )}
                </table>
              </div>
            </>
            )}
          </div>
        </div>

        {/* Sidebar tracker: submission status */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-zinc-50 text-navy-900 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="font-bold text-[10px] tracking-wider uppercase">Submission Tracker</h3>
              <span className="text-[10px] font-mono font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                {submissionStatus.filter(s => s.submitted).length} / {submissionStatus.length}
              </span>
            </div>

            <div className="p-4 divide-y divide-zinc-150 max-h-[600px] overflow-y-auto">
              {submissionStatus.map(emp => (
                <div key={emp.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-zinc-50/50 transition-colors rounded-lg px-2 -mx-2">
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-navy-900">{emp.name}</h5>
                    <p className="text-[10px] font-normal text-zinc-400">{emp.department || 'Staffing Department'}</p>
                  </div>

                  <div>
                    {emp.submitted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-250 uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Submitted</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-rose-50 text-rose-600 border border-rose-200 uppercase tracking-wider">
                        <XCircle className="w-3 h-3 text-rose-500" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
