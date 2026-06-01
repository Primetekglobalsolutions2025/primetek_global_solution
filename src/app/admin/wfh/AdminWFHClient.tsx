'use client';

import { useState, useTransition } from 'react';
import { 
  Calendar, Plus, Info, Search, Users, User, Home, 
  Loader2, Filter, ArrowRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { createWFHOverride, AdminWFHRequest, updateWFHRequest } from './actions';

interface ActiveEmployee {
  id: string;
  name: string;
  email: string;
}

export default function AdminWFHClient({
  initialRequests,
  employees
}: {
  initialRequests: AdminWFHRequest[];
  employees: ActiveEmployee[];
}) {
  const [requests, setRequests] = useState<AdminWFHRequest[]>(initialRequests);
  const [isGlobal, setIsGlobal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'global' | 'individual'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'past'>('all');
  
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [editingRequest, setEditingRequest] = useState<AdminWFHRequest | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editStatus, setEditStatus] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [isUpdating, startUpdateTransition] = useTransition();

  const handleOpenEdit = (req: AdminWFHRequest) => {
    setEditingRequest(req);
    setEditStartDate(req.start_date);
    setEditEndDate(req.end_date);
    setEditReason(req.reason || '');
    setEditStatus(req.status);
  };

  const handleUpdateOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;

    startUpdateTransition(async () => {
      const res = await updateWFHRequest(editingRequest.id, {
        start_date: editStartDate,
        end_date: editEndDate,
        reason: editReason,
        status: editStatus
      });

      if (res.success && res.request) {
        toast.success('WFH request updated successfully.');
        setRequests(prev => prev.map(r => r.id === editingRequest.id ? {
          ...r,
          start_date: editStartDate,
          end_date: editEndDate,
          reason: editReason,
          status: editStatus
        } : r));
        setEditingRequest(null);
      } else {
        toast.error(res.error || 'Failed to update WFH request.');
      }
    });
  };

  const handleCreateOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Start date cannot be after end date.');
      return;
    }
    if (!isGlobal && !selectedEmployeeId) {
      toast.error('Please select an employee or check "Global Override".');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please specify a reason for this WFH scheduling.');
      return;
    }

    startTransition(async () => {
      const res = await createWFHOverride({
        employee_id: isGlobal ? null : selectedEmployeeId,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim()
      });

      if (res.success && res.request) {
        toast.success(
          isGlobal 
            ? 'Global WFH override announced successfully.' 
            : 'Individual WFH schedule approved successfully.'
        );
        
        // Enrich the newly created request for the list
        const employee = isGlobal ? null : employees.find(e => e.id === selectedEmployeeId);
        const enriched: AdminWFHRequest = {
          ...res.request,
          employee_name: isGlobal ? 'Global (All Employees)' : employee?.name || 'Unknown Employee',
          employee_email: isGlobal ? '' : employee?.email || ''
        };

        setRequests(prev => [enriched, ...prev]);
        
        // Reset form fields
        setSelectedEmployeeId('');
        setStartDate('');
        setEndDate('');
        setReason('');
      } else {
        toast.error(res.error || 'Failed to schedule WFH override.');
      }
    });
  };

  const getRequestStatus = (req: AdminWFHRequest) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (req.end_date < todayStr) return 'past';
    if (req.start_date <= todayStr && req.end_date >= todayStr) return 'active';
    return 'upcoming';
  };

  const filteredRequests = requests.filter(req => {
    // 1. Search Query
    const searchMatch = !searchQuery 
      ? true 
      : req.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        req.reason?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 2. Filter Type (Global vs Individual)
    const typeMatch = filterType === 'all' 
      ? true 
      : filterType === 'global' 
        ? req.employee_id === null 
        : req.employee_id !== null;

    // 3. Filter Status (Active/Upcoming vs Past)
    const todayStr = new Date().toISOString().split('T')[0];
    let statusMatch = true;
    if (filterStatus === 'active') {
      statusMatch = req.end_date >= todayStr;
    } else if (filterStatus === 'past') {
      statusMatch = req.end_date < todayStr;
    }

    return searchMatch && typeMatch && statusMatch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch font-sans text-zinc-650">
      {/* Left List Column */}
      <div className="lg:col-span-8 flex flex-col space-y-4">
        <Card hover={false} className="p-4 border border-[#E2E8F0] shadow-2xs bg-white space-y-4 flex flex-col justify-between">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-primary-600" />
              <h2 className="font-bold text-[#0F172A] text-base tracking-tight">Active & Scheduled Overrides</h2>
            </div>
            
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search reasons or names..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full sm:w-[200px] border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white placeholder:text-zinc-400"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-2 border border-zinc-200 rounded-lg text-xs bg-white text-navy-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-600"
              >
                <option value="all">All Types</option>
                <option value="global">Global Only</option>
                <option value="individual">Individual Only</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-zinc-200 rounded-lg text-xs bg-white text-navy-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-600"
              >
                <option value="all">All Dates</option>
                <option value="active">Active & Upcoming</option>
                <option value="past">Past Only</option>
              </select>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[#E2E8F0] rounded-xl text-zinc-400">
              <Home className="w-8 h-8 stroke-[1.5] mb-2 text-zinc-300" />
              <p className="text-xs font-semibold">No scheduled WFH overrides found</p>
              <p className="text-[10px] text-zinc-400 mt-1">Change filters or create a new override in the form.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {filteredRequests.map((req) => {
                  const status = getRequestStatus(req);
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={cn(
                        "p-4 rounded-xl border-t border-r border-b border-l-4 transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white",
                        status === 'active' 
                          ? "border-teal-200 border-l-emerald-500 bg-teal-50/10" 
                          : status === 'upcoming' 
                            ? "border-blue-100 border-l-blue-500 bg-blue-50/5" 
                            : "border-zinc-200 border-l-zinc-300 bg-zinc-50/20 opacity-80"
                      )}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {req.employee_id === null ? (
                            <span className="inline-flex items-center gap-1 bg-primary-50 text-primary-600 text-[9px] font-black px-2 py-0.5 rounded border border-primary-600/10 uppercase tracking-wider font-mono">
                              <Users className="w-3 h-3" /> Global Override
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 text-[9px] font-bold px-2 py-0.5 rounded border border-zinc-200 uppercase tracking-wider font-mono">
                              <User className="w-3 h-3 text-zinc-500" /> Individual
                            </span>
                          )}

                          <span className={cn(
                            "text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-widest border",
                            status === 'active' 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : status === 'upcoming' 
                                ? "bg-blue-50 text-blue-700 border-blue-200" 
                                : "bg-zinc-100 text-zinc-650 border-zinc-200"
                          )}>
                            {status}
                          </span>
                        </div>

                        <h4 className="text-sm font-extrabold text-navy-900 tracking-tight leading-none">
                          {req.employee_name}
                        </h4>
                        
                        {req.employee_email && (
                          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{req.employee_email}</p>
                        )}
                        
                        {req.reason && (
                          <p className="text-xs text-zinc-550 italic font-medium mt-1">&quot;{req.reason}&quot;</p>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-zinc-100 font-mono">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-navy-900 px-1 py-0.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400 mr-1" />
                          <span>{req.start_date}</span>
                          <ArrowRight className="w-3 h-3 text-zinc-400 mx-1" />
                          <span>{req.end_date}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 w-full justify-between sm:justify-end">
                          <span className="text-[9px] text-zinc-400">
                            Approved WFH
                          </span>
                          <button
                            onClick={() => handleOpenEdit(req)}
                            className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-[#64748B] hover:text-navy-900 rounded text-[9px] font-bold transition-all border-0 cursor-pointer active:scale-95"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </div>

      {/* Right Control Form Column */}
      <div className="lg:col-span-4 flex flex-col space-y-6">
        {/* Create Override Form */}
        <Card hover={false} className="p-6 border border-[#E2E8F0] shadow-xs bg-white">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-primary-600" />
            <h3 className="text-sm font-extrabold text-navy-900 uppercase tracking-wider">Schedule WFH</h3>
          </div>

          <form onSubmit={handleCreateOverride} className="space-y-4">
            {/* Global Checkbox Toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 bg-zinc-50/50">
              <input
                type="checkbox"
                id="isGlobalCheckbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-600 border-zinc-300 cursor-pointer"
              />
              <label htmlFor="isGlobalCheckbox" className="text-xs font-bold text-navy-900 cursor-pointer select-none">
                Global WFH Override
                <span className="block text-[9px] font-normal text-zinc-450 mt-0.5">Applies to all active employees</span>
              </label>
            </div>

            {/* Employee Selector (Enabled if NOT global) */}
            {!isGlobal && (
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Select Employee</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  required={!isGlobal}
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white cursor-pointer"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Start and End Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Reason / Announcement</label>
              <textarea
                placeholder={
                  isGlobal 
                    ? "Heavy rain warning, office maintenance, etc." 
                    : "Pre-approved family event, medical recovery WFH, etc."
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white placeholder:text-zinc-450 font-semibold"
              />
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary-600 hover:bg-[#0d6460] text-white text-xs font-bold uppercase tracking-wider py-3 flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer border-0 mt-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create WFH Overrides
                </>
              )}
            </Button>
          </form>
        </Card>
        
        {/* Info Card */}
        <Card hover={false} className="p-4 border border-zinc-200 bg-zinc-50/50 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <Info className="w-4.5 h-4.5 text-primary-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-extrabold text-navy-900 uppercase tracking-wide text-[10px]">How Overrides Work</p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                When a WFH override is active for an employee on a given date:
              </p>
              <ul className="list-disc pl-4 text-[10px] text-zinc-500 space-y-1">
                <li>Check-in bypasses geofencing validation.</li>
                <li>The attendance status is immediately marked as <strong className="text-teal-700">Approved WFH</strong>.</li>
                <li>No pending approvals are created in the queue for their clock-in.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Edit Request Modal */}
      <AnimatePresence>
        {editingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingRequest(null)}
              className="fixed inset-0 bg-navy-900/40 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 relative z-10 space-y-4"
            >
              <div>
                <h3 className="text-sm font-extrabold text-navy-900 uppercase tracking-wider">Edit WFH Override</h3>
                <p className="text-[10px] text-zinc-400 mt-1 font-mono">Request ID: {editingRequest.id.slice(0, 8)}...</p>
              </div>

              <form onSubmit={handleUpdateOverride} className="space-y-4 font-sans text-xs">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Employee</label>
                  <Input
                    type="text"
                    disabled
                    value={editingRequest.employee_name || 'Global Override'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Start Date</label>
                    <Input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">End Date</label>
                    <Input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Reason</label>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    required
                    rows={3}
                    className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white placeholder:text-zinc-455 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white cursor-pointer"
                  >
                    <option value="Pending">Pending (Awaiting Approval)</option>
                    <option value="Approved">Approved (Active WFH)</option>
                    <option value="Rejected">Rejected (Cancelled)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditingRequest(null)}
                    className="flex-1 border text-xs font-bold py-2.5 uppercase tracking-wider"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 bg-primary-600 hover:bg-[#0d6460] text-white text-xs font-bold py-2.5 uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
