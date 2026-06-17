'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Download, Filter, ChevronLeft, ChevronRight, Eye, X, Trash2, MessageSquare, Building2, Phone, Mail, Clock, ShieldCheck } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/Toast';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import StatusBadge from '@/components/ui/StatusBadge';

interface Inquiry {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  requirement: string;
  status: string;
  created_at: string;
}

interface InquiryTableProps {
  inquiries: Inquiry[];
  updateStatus: (id: string, status: string) => Promise<unknown>;
  deleteInquiry: (id: string) => Promise<unknown>;
}

const statusOptions = ['all', 'new', 'in-progress', 'contacted', 'qualified', 'resolved', 'closed'] as const;

const ITEMS_PER_PAGE = 8;

export default function InquiryTable({ inquiries, updateStatus, deleteInquiry }: InquiryTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [localInquiries, setLocalInquiries] = useState(inquiries);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ 
    message: string; 
    onConfirm: () => void;
    variant?: 'danger' | 'primary';
  } | null>(null);
  const { toast } = useToast();

  // Synchronize local state with props on update
  useEffect(() => {
    setLocalInquiries(inquiries);
    if (selectedInquiry) {
      const updated = inquiries.find(i => i.id === selectedInquiry.id);
      if (updated) {
        setSelectedInquiry(updated);
      }
    }
  }, [inquiries, selectedInquiry]);

  // Focus trap, Escape closing, and focus restoration for accessibility
  useEffect(() => {
    if (!selectedInquiry) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedInquiry(null);
        return;
      }

      if (e.key === 'Tab') {
        const drawer = document.getElementById('inquiry-details-drawer');
        if (!drawer) return;

        const focusableElements = drawer.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement || !lastElement) return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const previousActiveElement = document.activeElement as HTMLElement | null;

    // Set focus to the close button inside the drawer for immediate keyboard access
    const timer = setTimeout(() => {
      const drawer = document.getElementById('inquiry-details-drawer');
      const closeBtn = drawer?.querySelector<HTMLElement>('button');
      closeBtn?.focus();
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [selectedInquiry]);

  const filtered = useMemo(() => {
    return localInquiries.filter((inq) => {
      const matchesSearch =
        search === '' ||
        inq.name.toLowerCase().includes(search.toLowerCase()) ||
        inq.email.toLowerCase().includes(search.toLowerCase()) ||
        inq.company.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'all' || inq.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [localInquiries, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const oldStatus = localInquiries.find(i => i.id === id)?.status || 'new';
    setLocalInquiries((prev) =>
      prev.map((inq) => (inq.id === id ? { ...inq, status: newStatus } : inq))
    );
    try {
      await updateStatus(id, newStatus);
      toast.success('Inquiry status updated successfully.');
      if (selectedInquiry?.id === id) {
        setSelectedInquiry({ ...selectedInquiry, status: newStatus });
      }
    } catch {
      setLocalInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, status: oldStatus } : inq))
      );
      toast.error('Failed to update inquiry status.');
    }
  };
  
  const handleDelete = async (id: string, name: string) => {
    setConfirmAction({
      message: `Are you sure you want to delete the inquiry from ${name}? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteInquiry(id);
          setLocalInquiries(prev => prev.filter(inq => inq.id !== id));
          toast.success('Inquiry deleted successfully.');
          if (selectedInquiry?.id === id) setSelectedInquiry(null);
        } catch {
          toast.error('Failed to delete inquiry.');
        }
      }
    });
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Company', 'Phone', 'Requirement', 'Status', 'Date'];
    const rows = filtered.map((inq) => [
      inq.name,
      inq.email,
      inq.company,
      inq.phone,
      `"${inq.requirement.replace(/"/g, '""')}"`,
      inq.status,
      formatDate(inq.created_at),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `primetek-inquiries-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary-500 transition-colors" />
          <input
            type="text"
            placeholder="Search leads by name, email, or firm..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border/60 bg-white text-sm text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="pl-8 pr-8 py-2 rounded-lg border border-border/60 bg-white text-xs font-semibold uppercase tracking-wider text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm appearance-none cursor-pointer"
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'all' ? 'All Status' : opt.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportCSV}
            className="rounded-lg border-border/60 font-semibold px-4 h-[38px] active:scale-95 transition-all shadow-sm bg-white"
          >
            <Download className="w-4 h-4 mr-1.5" /> Export
          </Button>
        </div>
      </div>

      {/* 2. Mobile Card Layout */}
      <div className="block md:hidden space-y-3">
        {paginated.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-border/60">
            <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-2">
              <MessageSquare className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-xs text-text-muted font-semibold">No active inquiries in the ledger.</p>
          </div>
        ) : (
          paginated.map((inquiry) => (
            <Card key={inquiry.id} hover={false} className="p-4 rounded-xl border border-border/60 shadow-sm bg-white">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {inquiry.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-navy-900 leading-tight">{inquiry.name}</h4>
                    <p className="text-[10px] text-text-muted font-medium mt-0.5">{inquiry.email}</p>
                  </div>
                </div>
                <StatusBadge status={inquiry.status} className="text-[8px] px-1.5 py-0.5" />
              </div>

              <div className="grid grid-cols-2 gap-2 bg-surface-alt/40 p-2.5 rounded-lg text-[10px] mb-3">
                <div>
                  <span className="text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Company</span>
                  <div className="flex items-center gap-1 font-bold text-navy-900">
                    <Building2 className="w-3 h-3 text-primary-500/50" />
                    {inquiry.company || 'Private'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Received</span>
                  <span className="font-bold text-navy-900">{formatDate(inquiry.created_at)}</span>
                </div>
              </div>

              {inquiry.requirement && (
                <p className="text-xs text-text-secondary line-clamp-2 font-medium mb-3 leading-relaxed">
                  {inquiry.requirement}
                </p>
              )}

              <div className="flex items-center justify-between border-t border-border/40 pt-3">
                <button
                  onClick={() => setSelectedInquiry(inquiry)}
                  className="text-xs text-primary-500 hover:text-primary-600 font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Details</span>
                </button>
                <button
                  onClick={() => handleDelete(inquiry.id, inquiry.name)}
                  className="text-xs text-gray-400 hover:text-red-500 font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </Card>
          ))
        )}

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1 pt-2">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center bg-white text-navy-900 hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center bg-white text-navy-900 hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Desktop Table */}
      <Card hover={false} className="p-0 overflow-hidden border border-border/60 rounded-xl shadow-sm bg-white hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-alt/50">
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Inquirer</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Entity</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Message Preview</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Engagement</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-2.5">
                      <MessageSquare className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-xs text-text-muted font-semibold">No active inquiries in the ledger.</p>
                  </td>
                </tr>
              ) : (
                paginated.map((inquiry) => (
                  <tr key={inquiry.id} className="group hover:bg-surface-alt/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-white text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                          {inquiry.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-navy-900 leading-tight group-hover:text-primary-600 transition-colors">{inquiry.name}</p>
                          <p className="text-[10px] text-text-muted font-medium mt-0.5">{inquiry.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-navy-900 uppercase tracking-tighter">
                        <Building2 className="w-3.5 h-3.5 text-primary-500/50" />
                        {inquiry.company || 'Private'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs text-text-secondary line-clamp-1 max-w-[280px] font-medium">
                        {inquiry.requirement}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={inquiry.status} className="text-[8px] px-1.5 py-0.5" />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => setSelectedInquiry(inquiry)}
                          className="w-6.5 h-6.5 rounded text-primary-500 hover:bg-primary-50 transition-all flex items-center justify-center active:scale-95 cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(inquiry.id, inquiry.name)}
                          className="w-6.5 h-6.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center active:scale-95 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 3. Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border/60 flex items-center justify-between bg-surface-alt/10">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Record {(page - 1) * ITEMS_PER_PAGE + 1} – {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center bg-white text-navy-900 hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center bg-white text-navy-900 hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 4. Side Detail Drawer (Premium Redesign) */}
      <AnimatePresence>
        {selectedInquiry && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-zinc-50 backdrop-blur-md" 
              onClick={() => setSelectedInquiry(null)} 
            />
            <motion.div 
              id="inquiry-details-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="drawer-title"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 z-[101] w-full max-w-xl bg-white shadow-2xl overflow-y-auto border-l border-border/50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="sticky top-0 z-20 px-6 py-5 bg-white/80 backdrop-blur-xl border-b border-border/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-primary-500">Inquiry Context</span>
                  </div>
                  <h2 id="drawer-title" className="text-lg font-semibold text-navy-900 tracking-tight">Request Details</h2>
                </div>
                <button 
                  onClick={() => setSelectedInquiry(null)} 
                  className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center text-text-muted hover:text-navy-900 transition-colors active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-6 space-y-6 pb-16">
                {/* 1. Profile Section */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-navy-900 to-navy-800 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-navy-900/10 mb-4">
                    {selectedInquiry.name.substring(0, 2).toUpperCase()}
                  </div>
                  <h3 className="text-base font-bold text-navy-900 tracking-tight">{selectedInquiry.name}</h3>
                  <p className="text-primary-500 font-semibold text-xs mt-0.5">{selectedInquiry.company || 'Independent Lead'}</p>
                </div>

                {/* 2. Contact Metadata */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-alt/50 rounded-xl p-4 border border-border/50">
                    <Mail className="w-4 h-4 text-primary-500 mb-2.5" />
                    <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-0.5">Email Endpoint</p>
                    <p className="text-xs font-semibold text-navy-900 break-all">{selectedInquiry.email}</p>
                  </div>
                  <div className="bg-surface-alt/50 rounded-xl p-4 border border-border/50">
                    <Phone className="w-4 h-4 text-emerald-500 mb-2.5" />
                    <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-0.5">Direct Line</p>
                    <p className="text-xs font-semibold text-navy-900">{selectedInquiry.phone || 'N/A'}</p>
                  </div>
                  <div className="col-span-2 bg-surface-alt/50 rounded-xl p-4 border border-border/50">
                    <Clock className="w-4 h-4 text-violet-500 mb-2.5" />
                    <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-0.5">Received On</p>
                    <p className="text-xs font-semibold text-navy-900">{formatDate(selectedInquiry.created_at)}</p>
                  </div>
                </div>

                {/* 3. Requirement Details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary-500" />
                    <h4 className="text-[10px] font-bold text-navy-900 uppercase tracking-wider">Requirement Statement</h4>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-xs text-navy-900 leading-relaxed font-medium border border-border">
                    {selectedInquiry.requirement}
                  </div>
                </div>

                {/* 4. Action Center */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-[10px] font-bold text-navy-900 uppercase tracking-wider">Pipeline Management</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {statusOptions.filter(s => s !== 'all').map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(selectedInquiry.id, s)}
                        className={cn(
                          "px-4 py-2.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all border text-center cursor-pointer",
                          selectedInquiry.status === s
                            ? "bg-navy-900 text-white border-navy-900 shadow-sm scale-[1.01]"
                            : "bg-white text-gray-500 border-border hover:border-navy-200"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        message={confirmAction?.message || ''}
        variant={confirmAction?.variant}
      />
    </div>
  );
}
