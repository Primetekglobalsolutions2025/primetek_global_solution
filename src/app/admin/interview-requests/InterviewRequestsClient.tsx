'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Search, Download, Calendar, Phone, 
  Briefcase, Clock, CheckCircle2, XCircle, 
  Loader2, Mail, FileText, FileUser, AlertCircle 
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { updateInterviewStatus } from './actions';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';

interface InterviewRequest {
  id: string;
  profile_id: string;
  employee_id: string;
  consultant_name: string;
  consultant_phone: string;
  consultant_technology: string;
  client_company: string;
  interview_datetime: string;
  interview_platform: string;
  resume_type: 'original' | 'updated';
  updated_resume_url: string | null;
  jd_url: string | null;
  status: 'pending' | 'acknowledged' | 'completed' | 'cancelled';
  created_at: string;
  employee?: { name: string };
  profile?: { resume_url: string };
}

export default function InterviewRequestsClient({ initialRequests }: { initialRequests: InterviewRequest[] }) {
  const [requests, setRequests] = useState<InterviewRequest[]>(initialRequests);
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchValue);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchValue]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesSearch = 
        req.consultant_name?.toLowerCase().includes(search.toLowerCase()) ||
        req.employee?.name?.toLowerCase().includes(search.toLowerCase()) ||
        req.client_company?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setLoadingId(id);
    try {
      const res = await updateInterviewStatus(id, newStatus);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setRequests(prev => prev.map(req => req.id === id ? { ...req, status: newStatus as any } : req));
      toast.success(`Request marked as ${newStatus} successfully.`);
    } catch (err) {
      toast.error('Failed to update status.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-zinc-650 font-sans">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-lg border border-zinc-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Support Interview Requests</h1>
          </div>
          <p className="text-xs text-zinc-450">
            View and manage interview support requests submitted by employees.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg border border-zinc-200 shadow-2xs">
        <div className="relative w-full sm:max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by consultant, employee, or company..." 
            value={searchValue} 
            onChange={(e) => setSearchValue(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 rounded-md border border-zinc-200 bg-white text-xs font-semibold text-navy-900 placeholder:text-zinc-450 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/20 transition-all shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <label className="text-xs font-bold text-navy-900 shrink-0">Status:</label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-zinc-200 bg-white text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer min-w-[120px] shadow-2xs"
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* List Layout */}
      <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-16 text-center bg-white">
            <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mx-auto mb-3">
              <FileUser className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-xs font-semibold text-navy-900 uppercase tracking-wider font-mono">No Support Requests Found</p>
            <p className="text-[11px] text-zinc-450 mt-0.5">No interview requests match your current search/filter settings.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 text-zinc-650 border-b border-zinc-200">
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Consultant Info</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Client / Company</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Assigned Employee</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Date & Platform</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Documents</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Status</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150">
                  {filteredRequests.map((req) => {
                    const formattedEstTime = new Date(req.interview_datetime).toLocaleString('en-US', {
                      timeZone: 'America/New_York',
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    });
                    const resumeUrl = req.resume_type === 'updated' ? req.updated_resume_url : req.profile?.resume_url;

                    return (
                      <tr key={req.id} className="hover:bg-zinc-50/50 transition-colors group text-zinc-600">
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-navy-900 tracking-tight font-sans">
                              {req.consultant_name}
                            </span>
                            <span className="text-[9px] font-mono font-semibold text-primary-750 uppercase tracking-wider mt-0.5">
                              {req.consultant_technology}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap text-xs font-semibold text-navy-900">
                          {req.client_company}
                        </td>
                        <td className="p-4 whitespace-nowrap text-xs font-semibold text-navy-900">
                          {req.employee?.name || 'Unknown'}
                        </td>
                        <td className="p-4 whitespace-nowrap text-[10px]">
                          <div className="flex flex-col font-mono text-zinc-500 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                              <span>{formattedEstTime}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] text-zinc-400">
                              <Briefcase className="w-3.5 h-3.5 text-zinc-350" />
                              <span>{req.interview_platform}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap text-xs">
                          <div className="flex flex-col gap-1">
                            {resumeUrl ? (
                              <a 
                                href={resumeUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                onClick={(e) => {
                                  if (!window.confirm('Are you sure you want to download the candidate resume?')) {
                                    e.preventDefault();
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold text-primary-750 hover:text-primary-850 uppercase tracking-wider bg-primary-50/50 border border-primary-200/40 px-2 py-0.5 rounded w-fit"
                              >
                                <Download className="w-3 h-3" /> Resume
                              </a>
                            ) : (
                              <span className="text-zinc-450 text-[9px] italic">No Resume</span>
                            )}
                            {req.jd_url ? (
                              <a 
                                href={req.jd_url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                onClick={(e) => {
                                  if (!window.confirm('Are you sure you want to download the Job Description (JD) document?')) {
                                    e.preventDefault();
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold text-primary-750 hover:text-primary-850 uppercase tracking-wider bg-primary-50/50 border border-primary-200/40 px-2 py-0.5 rounded w-fit"
                              >
                                <Download className="w-3 h-3" /> JD DOC
                              </a>
                            ) : (
                              <span className="text-zinc-450 text-[9px] italic">No JD</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <StatusBadge status={req.status} className="text-[8px] px-2.5 py-0.5" />
                        </td>
                        <td className="p-4 whitespace-nowrap text-right text-xs">
                          <div className="flex justify-end gap-1.5">
                            {req.status === 'pending' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleStatusUpdate(req.id, 'cancelled')}
                                  disabled={loadingId !== null}
                                  className="border-red-200 text-red-655 hover:bg-red-50 py-1 px-2.5 rounded-md text-[9px] font-bold"
                                >
                                  {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Cancel'}
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleStatusUpdate(req.id, 'acknowledged')}
                                  disabled={loadingId !== null}
                                  className="bg-primary-600 hover:bg-primary-700 text-white py-1 px-2.5 rounded-md text-[9px] font-bold"
                                >
                                  {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Acknowledge'}
                                </Button>
                              </>
                            )}

                            {req.status === 'acknowledged' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleStatusUpdate(req.id, 'cancelled')}
                                  disabled={loadingId !== null}
                                  className="border-red-200 text-red-655 hover:bg-red-50 py-1 px-2.5 rounded-md text-[9px] font-bold"
                                >
                                  {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Cancel'}
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleStatusUpdate(req.id, 'completed')}
                                  disabled={loadingId !== null}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-1 px-2.5 rounded-md text-[9px] font-bold"
                                >
                                  {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Complete'}
                                </Button>
                              </>
                            )}

                            {req.status !== 'pending' && req.status !== 'acknowledged' && (
                              <span className="text-[10px] text-zinc-400 font-mono font-medium italic">
                                Action Logged · {new Date(req.created_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked List View */}
            <div className="block xl:hidden divide-y divide-zinc-150">
              {filteredRequests.map((req) => {
                const formattedEstTime = new Date(req.interview_datetime).toLocaleString('en-US', {
                  timeZone: 'America/New_York',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                });
                const resumeUrl = req.resume_type === 'updated' ? req.updated_resume_url : req.profile?.resume_url;

                return (
                  <div key={req.id} className="p-4 hover:bg-zinc-50/50 transition-colors space-y-3 text-zinc-650">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-navy-900">{req.consultant_name}</h3>
                        <span className="text-[9px] font-mono font-semibold text-primary-750 uppercase tracking-wider block mt-0.5">
                          {req.consultant_technology}
                        </span>
                      </div>
                      <StatusBadge status={req.status} className="text-[8px] px-2.5 py-0.5" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-zinc-50/50 p-2.5 rounded border border-zinc-200/60 text-[10px]">
                      <div>
                        <span className="text-zinc-500 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Client / Platform</span>
                        <span className="font-semibold text-navy-900 block truncate">{req.client_company} · {req.interview_platform}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">DateTime (EST)</span>
                        <span className="font-semibold text-navy-900 block font-mono">{formattedEstTime}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Employee</span>
                        <span className="font-semibold text-navy-900 block truncate">{req.employee?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex flex-col gap-1 justify-end">
                        {resumeUrl && (
                          <a 
                            href={resumeUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => {
                              if (!window.confirm('Are you sure you want to download the candidate resume?')) {
                                    e.preventDefault();
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[8px] font-mono font-semibold text-primary-700 hover:text-primary-800 uppercase tracking-wider"
                          >
                            <Download className="w-3.5 h-3.5" /> Resume
                          </a>
                        )}
                        {req.jd_url && (
                          <a 
                            href={req.jd_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => {
                              if (!window.confirm('Are you sure you want to download the Job Description (JD) document?')) {
                                    e.preventDefault();
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[8px] font-mono font-semibold text-primary-700 hover:text-primary-800 uppercase tracking-wider"
                          >
                            <Download className="w-3.5 h-3.5" /> JD Attached
                          </a>
                        )}
                      </div>
                    </div>

                    {(req.status === 'pending' || req.status === 'acknowledged') ? (
                      <div className="flex gap-2 justify-end pt-1">
                        {req.status === 'pending' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleStatusUpdate(req.id, 'cancelled')}
                              disabled={loadingId !== null}
                              className="border-red-200 text-red-600 hover:bg-red-50 py-1 px-3 rounded-md text-[9px] font-bold"
                            >
                              {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Cancel'}
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handleStatusUpdate(req.id, 'acknowledged')}
                              disabled={loadingId !== null}
                              className="bg-primary-600 hover:bg-primary-700 text-white py-1 px-3 rounded-md text-[9px] font-bold"
                            >
                              {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Acknowledge'}
                            </Button>
                          </>
                        )}

                        {req.status === 'acknowledged' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleStatusUpdate(req.id, 'cancelled')}
                              disabled={loadingId !== null}
                              className="border-red-200 text-red-600 hover:bg-red-50 py-1 px-3 rounded-md text-[9px] font-bold"
                            >
                              {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Cancel'}
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handleStatusUpdate(req.id, 'completed')}
                              disabled={loadingId !== null}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white py-1 px-3 rounded-md text-[9px] font-bold"
                            >
                              {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Complete'}
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[9px] text-zinc-400 font-mono font-medium italic pt-1 border-t border-zinc-100">
                        <span>Immutable Support Ledger</span>
                        <span>Created: {new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
