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
  }, [date, selectedEmployee]);

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
    <div className="space-y-6 pb-12">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary-500" />
            <h1 className="text-xl font-bold text-navy-900 tracking-tight font-display">Daily Recruitment Reports</h1>
          </div>
          <p className="text-xs text-text-muted">
            View, track submission status, and export daily metrics from employees.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleExportExcel}
            disabled={exporting || reports.length === 0}
            variant="outline"
            className="border-amber-400 text-amber-600 hover:bg-amber-50 cursor-pointer min-h-[40px] text-xs font-bold font-sans"
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
          <Card className="p-4 rounded-2xl border border-border/80 shadow-sm bg-white" hover={false}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Date Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-navy-900">Select Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
                  <input
                    type="date"
                    value={date}
                    max={todayISTStr}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-border rounded-xl focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 text-xs font-medium text-navy-900 cursor-pointer bg-white"
                  />
                </div>
              </div>

              {/* Employee Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-navy-900">Filter By Employee</label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-border rounded-xl focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 text-xs font-medium text-navy-900 cursor-pointer bg-white"
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
                <div className="w-full bg-slate-50 border border-border rounded-xl p-3 flex justify-between items-center">
                  <div className="text-left">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Total Submissions Today</span>
                    <h4 className="text-lg font-extrabold text-navy-900 mt-0.5">
                      {submissionStatus.filter(s => s.submitted).length} / {submissionStatus.length}
                    </h4>
                  </div>
                  <div className="h-8 w-1 bg-primary-400 rounded-full" />
                </div>
              </div>
            </div>
          </Card>

          {/* Reports Table Area */}
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden min-h-[300px] relative">
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
                <ClipboardList className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-25" />
                <h4 className="text-sm font-bold text-navy-900">No Reports Found</h4>
                <p className="text-xs text-text-secondary max-w-sm mx-auto mt-1">
                  There are no daily metrics reports submitted for the selected criteria on this date.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-navy-900 text-white border-b border-navy-800">
                      <th className="p-4 font-semibold">Assign Date</th>
                      <th className="p-4 font-semibold">Consultant Name</th>
                      <th className="p-4 font-semibold text-center bg-navy-800/40">Apps Count</th>
                      <th className="p-4 font-semibold text-center bg-navy-800/40">Interviews</th>
                      <th className="p-4 font-semibold text-center">Assessments</th>
                      <th className="p-4 font-semibold text-center">Tech Rounds</th>
                      <th className="p-4 font-semibold text-center">Non-Tech</th>
                      <th className="p-4 font-semibold text-center bg-amber-950/20 text-amber-300 font-bold">Self</th>
                      <th className="p-4 font-semibold text-center bg-amber-950/20 text-amber-300 font-bold">Support</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
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
                        <tr key={empId} className="contents">
                          {/* Employee Section Header Row */}
                          <tr className="bg-slate-50 border-b border-border/80">
                            <td colSpan={9} className="p-3 font-bold text-primary-600 uppercase tracking-wider text-[10px]">
                              👤 {group.employeeName}
                            </td>
                          </tr>
                          
                          {/* Profile Metric Rows */}
                          {group.items.map(item => {
                            const pDate = item.profile?.created_at 
                              ? formatDate(item.profile.created_at) 
                              : '—';
                            const cName = item.profile?.client_name || 'Deleted Consultant';

                            return (
                              <tr key={item.id} className="hover:bg-slate-50/20 transition-colors">
                                <td className="p-4 text-text-secondary whitespace-nowrap">{pDate}</td>
                                <td className="p-4 font-semibold text-navy-900">{cName}</td>
                                <td className="p-4 text-center bg-slate-50/20 font-medium text-navy-900">{item.applications_count}</td>
                                <td className="p-4 text-center bg-slate-50/20 font-medium text-navy-900">{item.interviews_count}</td>
                                <td className="p-4 text-center font-medium text-navy-900">{item.assessments}</td>
                                <td className="p-4 text-center font-medium text-navy-900">{item.technical_rounds}</td>
                                <td className="p-4 text-center font-medium text-navy-900">{item.non_technical}</td>
                                <td className="p-4 text-center bg-amber-50/10 font-bold text-amber-800">{item.self_submissions}</td>
                                <td className="p-4 text-center bg-amber-50/10 font-bold text-amber-800">{item.support_submissions}</td>
                              </tr>
                            );
                          })}

                          {/* Employee Group Summary Row */}
                          <tr className="bg-slate-50/50 border-b-2 border-border font-semibold">
                            <td className="p-3 text-text-secondary text-[11px] italic">Group Total</td>
                            <td className="p-3 font-bold text-navy-900 text-[11px]">{group.employeeName}</td>
                            <td className="p-3 text-center text-[11px] bg-slate-100/50 font-bold text-navy-950">{empApps}</td>
                            <td className="p-3 text-center text-[11px] bg-slate-100/50 font-bold text-navy-950">{empInts}</td>
                            <td className="p-3 text-center text-[11px] font-bold text-navy-950">{empAssess}</td>
                            <td className="p-3 text-center text-[11px] font-bold text-navy-950">{empTech}</td>
                            <td className="p-3 text-center text-[11px] font-bold text-navy-950">{empNonTech}</td>
                            <td className="p-3 text-center text-[11px] bg-amber-100/10 font-bold text-amber-800">{empSelf}</td>
                            <td className="p-3 text-center text-[11px] bg-amber-100/10 font-bold text-amber-800">{empSupp}</td>
                          </tr>
                        </tr>
                      );
                    })}

                    {/* Table Grand Summary Row */}
                    <tr className="bg-amber-50/30 border-t-2 border-amber-300 font-extrabold text-[12px]">
                      <td className="p-4 text-amber-900">GRAND TOTAL</td>
                      <td className="p-4 text-amber-900">ALL SELECTED</td>
                      <td className="p-4 text-center bg-amber-100/40 text-amber-950">{grandTotalApps}</td>
                      <td className="p-4 text-center bg-amber-100/40 text-amber-950">{grandTotalInts}</td>
                      <td className="p-4 text-center text-amber-950">{grandTotalAssess}</td>
                      <td className="p-4 text-center text-amber-950">{grandTotalTech}</td>
                      <td className="p-4 text-center text-amber-950">{grandTotalNonTech}</td>
                      <td className="p-4 text-center bg-amber-100/20 text-amber-900">{grandTotalSelf}</td>
                      <td className="p-4 text-center bg-amber-100/20 text-amber-900">{grandTotalSupp}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar tracker: submission status */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 bg-navy-900 text-white border-b border-navy-800 flex items-center justify-between">
              <h3 className="font-bold text-xs tracking-wider uppercase">Submission Tracker</h3>
              <span className="text-[10px] bg-amber-400 text-navy-950 font-extrabold px-2 py-0.5 rounded-full">
                {submissionStatus.filter(s => s.submitted).length} / {submissionStatus.length}
              </span>
            </div>

            <div className="p-4 divide-y divide-border max-h-[600px] overflow-y-auto">
              {submissionStatus.map(emp => (
                <div key={emp.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50 transition-colors rounded-lg px-2 -mx-2">
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-navy-900">{emp.name}</h5>
                    <p className="text-[10px] text-text-muted">{emp.department || 'Staffing Department'}</p>
                  </div>

                  <div>
                    {emp.submitted ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Submitted</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                        <XCircle className="w-3 h-3" />
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
