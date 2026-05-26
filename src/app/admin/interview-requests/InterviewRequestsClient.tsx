'use client';

import { useState, useMemo } from 'react';
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

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  acknowledged: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function InterviewRequestsClient({ initialRequests }: { initialRequests: InterviewRequest[] }) {
  const [requests, setRequests] = useState<InterviewRequest[]>(initialRequests);
  const [search, setSearch] = useState('');
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
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-heading font-bold text-navy-900">Support Interview Requests</h1>
        <p className="text-text-secondary text-sm">View and manage interview support requests submitted by employees.</p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-border/60 shadow-sm">
        <div className="relative w-full sm:max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by consultant, employee, or company..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border/60 bg-white text-sm text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider shrink-0">Status:</label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer"
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredRequests.length === 0 && (
          <div className="col-span-full p-16 text-center bg-white rounded-xl border border-dashed border-border/60">
            <div className="w-14 h-14 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
              <FileUser className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-bold text-navy-900 mb-1">No Support Requests Found</p>
            <p className="text-xs text-text-muted font-medium">No interview requests match your current search/filter settings.</p>
          </div>
        )}
        {filteredRequests.map(req => {
          const formattedEstTime = new Date(req.interview_datetime).toLocaleString('en-US', {
            timeZone: 'America/New_York',
            dateStyle: 'medium',
            timeStyle: 'short',
          });

          // Resume link logic: check if updated resume url is set, otherwise fallback to original profile resume url
          const resumeUrl = req.resume_type === 'updated' ? req.updated_resume_url : req.profile?.resume_url;

          return (
            <Card key={req.id} className="p-5 flex flex-col h-full border-t-4 border-t-navy-900 bg-white hover:shadow-md transition-all duration-200 group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-heading font-bold text-navy-900 text-base">{req.consultant_name}</h3>
                  <p className="text-xs text-primary-600 font-bold uppercase tracking-wider">{req.consultant_technology}</p>
                </div>
                <span className={cn(
                  "text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border",
                  statusColors[req.status] || statusColors.pending
                )}>
                  {req.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-4 flex-1 text-sm border-t border-b border-border/60 py-4 my-4">
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Assigned Employee</p>
                  <p className="font-semibold text-navy-900 truncate">{req.employee?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Client / Company</p>
                  <p className="font-semibold text-navy-900 truncate">{req.client_company}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Interview Date & Time (EST)</p>
                  <div className="flex items-center gap-1.5 text-navy-900 font-semibold text-xs mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-text-muted" />
                    <span>{formattedEstTime}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Platform / Method</p>
                  <div className="flex items-center gap-1.5 text-navy-900 font-semibold text-xs mt-0.5">
                    <Briefcase className="w-3.5 h-3.5 text-text-muted" />
                    <span>{req.interview_platform}</span>
                  </div>
                </div>
                {req.consultant_phone && (
                  <div>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Consultant Contact</p>
                    <div className="flex items-center gap-1.5 text-navy-900 font-semibold text-xs mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-text-muted" />
                      <span>{req.consultant_phone}</span>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Resume Attachment</p>
                  {resumeUrl ? (
                    <a 
                      href={resumeUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1.5 mt-0.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{req.resume_type === 'updated' ? 'Updated Resume' : 'Original Resume'}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-text-muted italic flex items-center gap-1.5 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>No resume available</span>
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">JD Document (.docx)</p>
                  {req.jd_url ? (
                    <a 
                      href={req.jd_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1.5 mt-0.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download JD</span>
                    </a>
                  ) : (
                    <span className="text-xs text-text-muted italic flex items-center gap-1.5 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>No JD attached</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Status Actions */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] text-text-muted font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Requested: {new Date(req.created_at).toLocaleDateString()}</span>
                </span>
                
                {req.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleStatusUpdate(req.id, 'cancelled')}
                      disabled={loadingId !== null}
                      className="border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1 py-1 rounded-lg"
                    >
                      {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleStatusUpdate(req.id, 'acknowledged')}
                      disabled={loadingId !== null}
                      className="bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-1 py-1 rounded-lg"
                    >
                      {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Acknowledge
                    </Button>
                  </div>
                )}

                {req.status === 'acknowledged' && (
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleStatusUpdate(req.id, 'cancelled')}
                      disabled={loadingId !== null}
                      className="border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1 py-1 rounded-lg"
                    >
                      {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleStatusUpdate(req.id, 'completed')}
                      disabled={loadingId !== null}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 py-1 rounded-lg"
                    >
                      {loadingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Complete
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
