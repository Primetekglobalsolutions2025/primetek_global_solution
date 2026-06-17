'use client';

import { useState, useMemo, useRef } from 'react';
import { 
  Briefcase, 
  Building2, 
  ExternalLink, 
  ChevronRight, 
  Calendar, 
  X,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

interface JobApplication {
  employeeName: string;
  timestamp: string;
  clientName: string;
  jobRole: string;
  url: string;
  claimedBy?: string;
}

interface EmployeeApplicationsListProps {
  applications: JobApplication[];
  employeeName: string;
}

const ITEMS_PER_PAGE = 10;

export default function EmployeeApplicationsList({ applications, employeeName }: EmployeeApplicationsListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

  const drawerRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(drawerRef, !!selectedApp, () => setSelectedApp(null));

  const totalPages = useMemo(() => {
    return Math.ceil(applications.length / ITEMS_PER_PAGE) || 1;
  }, [applications.length]);

  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return applications.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [applications, currentPage]);

  const formatDateTimeIST = (timestampStr: string): { date: string; time: string } => {
    if (!timestampStr) return { date: 'N/A', time: '' };
    if (timestampStr.match(/^\d{2}-[A-Za-z]{3}$/)) {
      return { date: timestampStr, time: '' };
    }
    try {
      const dateObj = new Date(timestampStr);
      if (isNaN(dateObj.getTime())) return { date: timestampStr, time: '' };
      
      const formattedDate = dateObj.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
      const formattedTime = dateObj.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      });
      return { date: formattedDate, time: formattedTime };
    } catch {
      return { date: timestampStr, time: '' };
    }
  };

  const isShared = (app: JobApplication) => {
    const claimers = (app.claimedBy || app.employeeName).split(',').map(n => n.trim()).filter(Boolean);
    return claimers.length > 1;
  };

  return (
    <div className="space-y-4">
      <Card hover={false} className="p-0 overflow-hidden border border-zinc-200/80 rounded-xl shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50">
                <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40 w-[120px] md:w-[140px]">Date Logged</th>
                <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40">Job Details</th>
                <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 border-r border-zinc-150/40 w-[110px] md:w-[130px] hidden sm:table-cell">Claim Status</th>
                <th className="text-left px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider text-zinc-450 w-[110px] md:w-[130px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-zinc-400 text-xs font-semibold bg-zinc-50/20">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 text-zinc-300" />
                      <span>No applications logged or claimed yet.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((app, idx) => {
                  const istDT = formatDateTimeIST(app.timestamp);
                  const isClaimedByOther = app.employeeName !== employeeName;
                  const shared = isShared(app);

                  return (
                    <tr 
                      key={`${app.timestamp}-${idx}`} 
                      onClick={() => setSelectedApp(app)}
                      className="hover:bg-zinc-50/60 transition-all group cursor-pointer border-b border-zinc-100 last:border-0"
                    >
                      {/* Date */}
                      <td className="px-5 py-3 text-[10px] font-bold text-zinc-500 whitespace-nowrap font-mono border-r border-zinc-150/30">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{istDT.date}</span>
                        </div>
                      </td>

                      {/* Job Details */}
                      <td className="px-5 py-3 border-r border-zinc-150/30">
                        <div className="space-y-0.5 max-w-[200px] md:max-w-md">
                          <div className="flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-zinc-450 shrink-0" />
                            <p className="text-xs font-extrabold text-navy-900 truncate" title={app.jobRole}>
                              {app.jobRole || 'N/A'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="truncate" title={app.clientName}>{app.clientName || 'N/A'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Claim Status (Hidden on mobile) */}
                      <td className="px-5 py-3 border-r border-zinc-150/30 hidden sm:table-cell">
                        {isClaimedByOther ? (
                          <span className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/50 uppercase tracking-wider">
                            Claimed
                          </span>
                        ) : shared ? (
                          <span className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/50 uppercase tracking-wider">
                            Shared
                          </span>
                        ) : (
                          <span className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-md bg-zinc-50 text-zinc-650 border border-zinc-200/60 uppercase tracking-wider">
                            Logged
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {app.url && (
                            <a 
                              href={app.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => e.stopPropagation()}
                              title="Redirect to Application Page"
                              className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-primary-500 hover:text-primary-650 uppercase tracking-wider bg-primary-50/40 border border-primary-200/30 px-2 py-0.5 rounded transition-all shrink-0 cursor-pointer"
                            >
                              Link <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                          <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-650 transition-colors shrink-0" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-[10px] text-zinc-500 font-medium font-sans">
            Showing <span className="font-bold text-navy-900">{Math.min(applications.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span> to{' '}
            <span className="font-bold text-navy-900">{Math.min(applications.length, currentPage * ITEMS_PER_PAGE)}</span> of{' '}
            <span className="font-bold text-navy-900">{applications.length}</span> entries
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 text-[10px] rounded-lg border-zinc-250 text-navy-900 hover:bg-zinc-50"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-[10px] rounded-lg border-zinc-250 text-navy-900 hover:bg-zinc-50"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail Drawer (Slide-Over Panel) */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end bg-black/35 backdrop-blur-xs" onClick={() => setSelectedApp(null)}>
            <motion.div
              ref={drawerRef}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 200 }}
              className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto flex flex-col border-l border-zinc-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-zinc-200/80 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center shadow-sm">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-extrabold text-navy-900 uppercase tracking-wider font-sans">Application details</h2>
                </div>
                <button 
                  onClick={() => setSelectedApp(null)} 
                  className="p-1.5 rounded-lg hover:bg-zinc-150 text-zinc-450 hover:text-zinc-700 transition-colors cursor-pointer active:scale-95"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-6 space-y-6 flex-1 text-zinc-650">
                {/* Submit info */}
                <div className="pb-5 border-b border-zinc-150/50 space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block font-sans">Submitter Details</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-navy-900">
                      {selectedApp.employeeName === employeeName ? 'Logged by You' : `Logged by ${selectedApp.employeeName}`}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-450 font-bold font-mono mt-0.5">
                    Date: {formatDateTimeIST(selectedApp.timestamp).date} {formatDateTimeIST(selectedApp.timestamp).time}
                  </p>
                </div>

                {/* Job details */}
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1 font-sans">Job Role</span>
                    <p className="text-sm font-extrabold text-navy-900 bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl leading-relaxed">
                      {selectedApp.jobRole || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1 font-sans">Client Name</span>
                    <div className="bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-bold text-navy-900">{selectedApp.clientName || 'N/A'}</span>
                      <Building2 className="w-4 h-4 text-zinc-450 shrink-0" />
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1 font-sans">Claimed By</span>
                    <div className="bg-zinc-50 border border-zinc-200/50 p-3 rounded-xl flex flex-wrap gap-1.5">
                      {(selectedApp.claimedBy || selectedApp.employeeName).split(',').map((c) => {
                        const tr = c.trim();
                        if (!tr) return null;
                        const isMe = tr === employeeName;
                        return (
                          <span 
                            key={tr} 
                            className={cn(
                              "inline-block text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border",
                              isMe 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                                : "bg-zinc-50 text-zinc-650 border-zinc-200"
                            )}
                          >
                            {tr} {isMe && '(You)'}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {selectedApp.url && (
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1 font-sans">Application URL</span>
                      <div className="bg-zinc-50 border border-zinc-200/50 p-3.5 rounded-xl space-y-3">
                        <p className="text-[10px] text-zinc-550 break-all leading-normal select-all font-mono">
                          {selectedApp.url}
                        </p>
                        <a 
                          href={selectedApp.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs bg-navy-900 hover:bg-navy-950 text-white rounded-lg font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Application URL</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
