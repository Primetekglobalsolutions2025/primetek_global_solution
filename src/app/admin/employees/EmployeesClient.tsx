'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ToggleLeft, ToggleRight, X, Loader2, Trash2, Users, ShieldCheck, Mail, Briefcase, Sparkles, Wallet, AlertTriangle, Copy, Check } from 'lucide-react';
import Image from 'next/image';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { toggleEmployeeStatus, createEmployee, deleteEmployee, resetEmployeeMFA, getEmployeeBalances, updateEmployeeBalances, getAdminEmployees } from './actions';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/Toast';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';
import { useSafeReducedMotion } from '@/hooks/useSafeReducedMotion';

export interface EmployeeRecord {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  status: string;
  join_date: string;
  avatar_url: string | null;
  mfa_enabled?: boolean;
}

interface EmployeesClientProps {
  initialEmployees: EmployeeRecord[];
  initialTotalCount: number;
  initialStats: { total: number; active: number; inactive: number };
  initialDepartments: string[];
}

export default function EmployeesClient({ 
  initialEmployees,
  initialTotalCount,
  initialStats,
  initialDepartments
}: EmployeesClientProps) {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeRecord[]>(initialEmployees);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [stats, setStats] = useState(initialStats);
  const [departments, setDepartments] = useState<string[]>(initialDepartments);

  const [prevInitialEmployees, setPrevInitialEmployees] = useState(initialEmployees);
  if (initialEmployees !== prevInitialEmployees) {
    setPrevInitialEmployees(initialEmployees);
    setEmployees(initialEmployees);
    setTotalCount(initialTotalCount);
    setStats(initialStats);
    setDepartments(initialDepartments);
  }

  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const ITEMS_PER_PAGE = 100;

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchValue);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchValue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, departmentFilter]);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      setIsLoading(true);
      try {
        const result = await getAdminEmployees(currentPage, ITEMS_PER_PAGE, search, departmentFilter);
        if (active) {
          setEmployees(result.data);
          setTotalCount(result.count);
          setStats(result.stats);
          setDepartments(result.departments);
        }
      } catch (err) {
        console.error('Failed to fetch paginated employees:', err);
        toast.error('Failed to load employees from server.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      active = false;
    };
  }, [currentPage, search, departmentFilter, toast]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEmployeeData, setNewEmployeeData] = useState({ name: '', email: '', role: 'employee', department: '' });
  const [successMessage, setSuccessMessage] = useState<{ id: string; pass: string } | null>(null);
  
  const [formErrors, setFormErrors] = useState({ name: '', email: '', department: '' });
  const addEmployeeModalRef = useRef<HTMLDivElement>(null);
  const balanceModalRef = useRef<HTMLDivElement>(null);

  // Credentials copy & lock safety check states
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);
  const [balances, setBalances] = useState({ sick: 0, casual: 0, earned: 0 });

  useModalFocusTrap(addEmployeeModalRef, isModalOpen, () => {
    const isLocked = successMessage !== null && !credentialsSaved;
    if (!isLocked) {
      setIsModalOpen(false);
      if (successMessage) {
        setSuccessMessage(null);
        setCredentialsSaved(false);
        router.refresh();
      }
    }
  });

  useModalFocusTrap(balanceModalRef, isBalanceModalOpen, () => setIsBalanceModalOpen(false));
  const [confirmAction, setConfirmAction] = useState<{ 
    message: string; 
    onConfirm: () => void;
    variant?: 'danger' | 'primary';
  } | null>(null);

  const paginatedItems = employees;

  const totalPages = useMemo(() => {
    return Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
  }, [totalCount]);

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e)));
    
    try {
      const res = await toggleEmployeeStatus(id, currentStatus);
      if (res && res.success) {
        toast.success(`Employee status updated to ${newStatus}.`);
      } else {
        setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, status: currentStatus } : e)));
        toast.error(res?.error || 'Failed to update employee status.');
      }
    } catch (err) {
      setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, status: currentStatus } : e)));
      toast.error('Failed to update employee status.');
    }
  };

  const handleCopyCredentials = () => {
    if (!successMessage) return;
    const credentialsText = `Employee ID: ${successMessage.id}\nInitial Password: ${successMessage.pass}`;
    navigator.clipboard.writeText(credentialsText);
    setCopied(true);
    toast.success('Credentials copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setCredentialsSaved(false);

    let valid = true;
    const errors = { name: '', email: '', department: '' };

    if (!newEmployeeData.name || newEmployeeData.name.trim().length < 3) {
      errors.name = 'Name must be at least 3 characters.';
      valid = false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newEmployeeData.email || !emailRegex.test(newEmployeeData.email)) {
      errors.email = 'Please enter a valid email address.';
      valid = false;
    }
    if (!newEmployeeData.department) {
      errors.department = 'Please select a role/department.';
      valid = false;
    }

    setFormErrors(errors);
    if (!valid) {
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await createEmployee(newEmployeeData);
      if (res && res.success) {
        setSuccessMessage({ id: res.employee_id!, pass: res.password! });
        toast.success('Employee created successfully.');
      } else {
        toast.error(res?.error || 'Failed to create employee.');
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || 'Failed to create employee.');
      } else {
        toast.error('Failed to create employee.');
      }
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setConfirmAction({
      message: `Are you sure you want to delete ${name}? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await deleteEmployee(id);
          if (res && res.success) {
            setEmployees((prev) => prev.filter((e) => e.id !== id));
            toast.success('Employee deleted successfully.');
          } else {
            toast.error(res?.error || 'Failed to delete employee.');
          }
        } catch (err) {
          toast.error('Failed to delete employee.');
        }
      }
    });
  };

  const handleResetMFA = async (id: string, name: string) => {
    setConfirmAction({
      message: `Are you sure you want to reset MFA for ${name}? They will need to scan a new QR code on their next login attempt.`,
      variant: 'primary',
      onConfirm: async () => {
        try {
          const res = await resetEmployeeMFA(id);
          if (res && res.success) {
            // Update local status as well
            setEmployees(prev => prev.map(e => e.id === id ? { ...e, mfa_enabled: false } : e));
            toast.success('Employee MFA credentials reset successfully.');
          } else {
            toast.error(res?.error || 'Failed to reset employee MFA.');
          }
        } catch (err) {
          toast.error('Failed to reset employee MFA.');
        }
      }
    });
  };

  const handleOpenBalanceModal = async (emp: EmployeeRecord) => {
    setSelectedEmployee(emp);
    setIsBalanceModalOpen(true);
    try {
      const b = await getEmployeeBalances(emp.id);
      if (b) {
        setBalances({
          sick: b.find((x: any) => x.leave_type === 'Sick')?.total_days || 0,
          casual: b.find((x: any) => x.leave_type === 'Casual')?.total_days || 0,
          earned: b.find((x: any) => x.leave_type === 'Earned')?.total_days || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    }
  };

  const handleUpdateBalances = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setIsUpdatingBalance(true);
    try {
      const res = await updateEmployeeBalances(selectedEmployee.id, balances);
      if (res && res.success) {
        toast.success('Balances updated successfully.');
        setIsBalanceModalOpen(false);
      } else {
        toast.error(res?.error || 'Failed to update balances.');
      }
    } catch (err) {
      toast.error('Failed to update balances.');
    } finally {
      setIsUpdatingBalance(false);
    }
  };

  const isModalCloseLocked = successMessage !== null && !credentialsSaved;

  return (
    <div className="space-y-6 text-zinc-700">
      {/* 1. Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Total Staff', value: stats.total, icon: Users, color: 'text-navy-900', bg: 'bg-white border-zinc-200' },
          { label: 'Active', value: stats.active, icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/[0.03] border-emerald-500/20' },
          { label: 'Inactive', value: stats.inactive, icon: X, color: 'text-red-400', bg: 'bg-red-500/[0.03] border-red-500/20' },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-xl p-4 border shadow-sm flex items-center gap-3 bg-white border-zinc-200", s.bg)}>
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center bg-white border border-zinc-200 shadow-sm", s.color)}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-navy-900 leading-none">{s.value}</p>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex gap-2 flex-1 sm:max-w-lg">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by ID, name, email..." 
              value={searchValue} 
              onChange={(e) => setSearchValue(e.target.value)} 
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all shadow-sm font-medium" 
            />
          </div>
          {departments.length > 0 && (
            <select 
              value={departmentFilter} 
              onChange={(e) => setDepartmentFilter(e.target.value)} 
              className="pl-3 pr-8 py-2 rounded-lg border border-zinc-200 bg-white text-[10px] font-semibold uppercase tracking-wider text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer shadow-sm min-w-[130px] appearance-none"
            >
              <option value="all">Dept: ALL</option>
              {departments.map((dept) => <option key={dept} value={dept}>{dept.toUpperCase()}</option>)}
            </select>
          )}
        </div>
        <Button 
          onClick={() => {
            setSuccessMessage(null);
            setCredentialsSaved(false);
            setNewEmployeeData({ name: '', email: '', role: 'employee', department: '' });
            setFormErrors({ name: '', email: '', department: '' });
            setIsSubmitting(false);
            setIsModalOpen(true);
          }} 
          className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-white rounded-lg px-4 py-2.5 text-xs font-semibold shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Employee
        </Button>
      </div>

      {/* 3. Employees Mobile Cards & Desktop Table */}
      <div className={cn("block md:hidden space-y-3 transition-opacity duration-200", isLoading && "opacity-50 pointer-events-none")}>
        {employees.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-zinc-200">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto mb-2 border border-zinc-200">
              <Users className="w-5 h-5 text-zinc-650" />
            </div>
            <p className="text-xs text-zinc-500 font-semibold">No active personnel matching your query.</p>
          </div>
        ) : (
          paginatedItems.map((emp) => (
            <Card key={emp.id} hover={false} className="p-4 rounded-xl border border-zinc-200 shadow-sm bg-white text-zinc-600">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative shrink-0">
                    {emp.avatar_url ? (
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-200 relative">
                        <Image src={emp.avatar_url} alt={emp.name} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 text-[10px] font-bold">
                        {emp.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-navy-900 shadow-sm",
                      emp.status === 'Active' ? "bg-emerald-500" : "bg-zinc-600"
                    )} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-navy-900">{emp.name}</h4>
                    <p className="text-[10px] text-zinc-500 font-medium mt-0.5">{emp.email}</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-zinc-700 bg-white px-1.5 py-0.5 rounded border border-zinc-200 uppercase tracking-wider">
                  {emp.employee_id}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 bg-zinc-50/30 p-2.5 rounded-lg text-[10px] mb-3 border border-zinc-200">
                <div>
                  <span className="text-zinc-400 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Role</span>
                  <span className="font-bold text-zinc-700 uppercase tracking-wider">{emp.role}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Department</span>
                  <span className="font-bold text-zinc-700">{emp.department || 'General'}</span>
                </div>
              </div>

              {/* MFA Status bar/indicator (Mobile Card) */}
              <div className="mb-3">
                {emp.mfa_enabled ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold bg-emerald-500/5 border border-emerald-500/15 px-2.5 py-1 rounded-lg w-full">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>MFA Verified & Secure</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-bold bg-amber-500/5 border border-amber-500/15 px-2.5 py-1 rounded-lg w-full">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>MFA Setup Pending</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-zinc-200/40 pt-3">
                <button onClick={() => handleToggle(emp.id, emp.status)} aria-label={emp.status === 'Active' ? 'Deactivate employee' : 'Activate employee'} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 active:scale-95 transition-transform cursor-pointer">
                  <div className={cn(
                    "w-7 h-4 rounded-full relative transition-colors duration-300",
                    emp.status === 'Active' ? "bg-emerald-500" : "bg-zinc-600"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm",
                      emp.status === 'Active' ? "left-3.5" : "left-0.5"
                    )} />
                  </div>
                  <span className={emp.status === 'Active' ? 'text-emerald-500' : 'text-zinc-400'}>
                    {emp.status}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleOpenBalanceModal(emp)}
                    className="p-1.5 rounded bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Balance</span>
                  </button>
                  <button 
                    onClick={() => handleDelete(emp.id, emp.name)}
                    className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                  <button 
                    onClick={() => handleResetMFA(emp.id, emp.name)}
                    className="p-1.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                    title="Reset MFA"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Reset MFA</span>
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card hover={false} className={cn("p-0 overflow-hidden border border-zinc-200 rounded-xl shadow-sm bg-white hidden md:block transition-opacity duration-200", isLoading && "opacity-50 pointer-events-none")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-semibold text-navy-955 uppercase tracking-wider font-heading">
                <th className="px-4 py-3">Identity</th>
                <th className="px-4 py-3">Staff ID</th>
                <th className="px-4 py-3">Function</th>
                <th className="px-4 py-3">MFA verification</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100/60">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto mb-3 border border-zinc-200">
                      <Users className="w-5 h-5 text-zinc-650" />
                    </div>
                    <p className="text-xs text-zinc-500 font-bold">No active personnel matching your query.</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((emp) => (
                  <tr key={emp.id} className="group hover:bg-zinc-50/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {emp.avatar_url ? (
                            <div className="w-7 h-7 rounded-lg overflow-hidden shadow-sm border border-zinc-200">
                              <Image src={emp.avatar_url} alt={emp.name} fill className="object-cover" sizes="28px" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 text-[9px] font-bold shadow-sm">
                              {emp.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-navy-955 shadow-sm",
                            emp.status === 'Active' ? "bg-emerald-500" : "bg-zinc-550"
                          )} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-navy-900 leading-tight group-hover:text-primary-400 transition-colors">{emp.name}</p>
                          <p className="text-[10px] text-zinc-500 font-medium mt-0.5">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] font-bold text-navy-900 bg-white px-1.5 py-0.5 rounded border border-zinc-200 uppercase tracking-wider">
                        {emp.employee_id}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-semibold text-navy-900 uppercase tracking-wider">{emp.role}</p>
                        <p className="text-[9px] text-zinc-500 font-medium">{emp.department || 'General'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {emp.mfa_enabled ? (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg w-fit">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          <span>ACTIVE</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg w-fit">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                          <span>PENDING</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => handleToggle(emp.id, emp.status)} aria-label={emp.status === 'Active' ? 'Deactivate employee' : 'Activate employee'} className="flex items-center gap-2 active:scale-95 transition-transform group/toggle cursor-pointer">
                        <div className={cn(
                          "w-8 h-4.5 rounded-full relative transition-colors duration-300",
                          emp.status === 'Active' ? "bg-emerald-500" : "bg-zinc-650"
                        )}>
                          <div className={cn(
                            "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all duration-300 shadow-sm",
                            emp.status === 'Active' ? "left-4" : "left-0.5"
                          )} />
                        </div>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-wider",
                          emp.status === 'Active' ? "text-emerald-500" : "text-zinc-400"
                        )}>{emp.status}</span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenBalanceModal(emp)}
                          className="w-7 h-7 rounded text-zinc-500 hover:text-primary-400 hover:bg-primary-500/10 border border-transparent hover:border-primary-500/20 transition-all flex items-center justify-center active:scale-90 cursor-pointer"
                          title="Manage Balances"
                        >
                          <Wallet className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleResetMFA(emp.id, emp.name)}
                          className="w-7 h-7 rounded text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all flex items-center justify-center active:scale-90 cursor-pointer"
                          title="Reset Employee MFA"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(emp.id, emp.name)}
                          className="w-7 h-7 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all flex items-center justify-center active:scale-90 cursor-pointer"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination Widget */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
          <div className="text-xs text-zinc-500 font-medium">
            Showing <span className="font-bold text-navy-900">{totalCount === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
            <span className="font-bold text-navy-900">{Math.min(totalCount, currentPage * ITEMS_PER_PAGE)}</span> of{' '}
            <span className="font-bold text-navy-900">{totalCount}</span> entries
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 text-xs"
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              let pageNum = currentPage;
              if (currentPage <= 3) {
                pageNum = idx + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + idx;
              } else {
                pageNum = currentPage - 2 + idx;
              }
              
              if (pageNum < 1 || pageNum > totalPages) return null;

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="w-8 h-8 p-0 text-xs font-bold"
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* 4. Premium Add Employee Modal (Dark first) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-zinc-200 relative text-zinc-600"
            >
              <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
                <Users className="w-48 h-48 text-navy-900" />
              </div>

              <div className="flex items-center justify-between px-10 py-8 border-b border-zinc-200 bg-zinc-50/40">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">Staff Registry</span>
                  </div>
                  <h3 className="font-bold text-xl text-navy-900 tracking-tight">Onboard New Employee</h3>
                </div>
                <button 
                  onClick={() => { 
                    if (!isModalCloseLocked) {
                      setIsModalOpen(false); 
                      if (successMessage) {
                        setSuccessMessage(null);
                        router.refresh();
                      }
                    } else {
                      toast.error('Please confirm you have copied the credentials first.');
                    }
                  }} 
                  disabled={isModalCloseLocked}
                  className={cn(
                    "w-10 h-10 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-navy-900 transition-colors",
                    isModalCloseLocked && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="px-10 py-8">
                {successMessage ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-500/[0.03] border border-emerald-500/20 rounded-[2rem] p-6 text-center space-y-6"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-navy-900 text-lg tracking-tight">Credentials Generated Successfully</h4>
                      <p className="text-xs text-zinc-500 mt-2 font-medium">For security compliance, these temporary credentials must be copied now. They are hashed in the database and cannot be read after closing.</p>
                    </div>
                    
                    <div className="bg-zinc-50/80 p-5 rounded-2xl border border-zinc-200 text-left space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Employee Login ID</span>
                        <span className="text-xs font-black text-navy-900 font-mono bg-white border border-zinc-200 px-3 py-1 rounded">{successMessage.id}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Temporary Password</span>
                        <span className="text-xs font-black text-primary-400 font-mono bg-white border border-zinc-200 px-3 py-1 rounded">{successMessage.pass}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={handleCopyCredentials}
                        className="w-full bg-white hover:bg-zinc-50 text-navy-900 border border-zinc-200 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold active:scale-98 transition-all"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-450" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Credentials Copied!' : 'Copy Credentials to Clipboard'}
                      </Button>

                      {/* Modal closure checkbox validation lock */}
                      <div className="flex items-start gap-2.5 text-left p-3.5 bg-zinc-50/40 rounded-xl border border-zinc-200/60 mt-2">
                        <input 
                          type="checkbox" 
                          id="confirm-credentials-saved" 
                          checked={credentialsSaved} 
                          onChange={(e) => setCredentialsSaved(e.target.checked)} 
                          className="mt-0.5 rounded border-zinc-200 bg-white text-primary-500 focus:ring-primary-500/20 cursor-pointer w-4 h-4 shrink-0" 
                        />
                        <label htmlFor="confirm-credentials-saved" className="text-[10px] font-bold text-zinc-500 leading-normal cursor-pointer select-none uppercase tracking-wider">
                          ⚠️ I confirm that I have safely copied/saved the generated credentials for the employee.
                        </label>
                      </div>
                    </div>
                    
                    <Button 
                      disabled={!credentialsSaved}
                      onClick={() => {
                        setIsModalOpen(false);
                        setSuccessMessage(null);
                        setCredentialsSaved(false);
                        router.refresh();
                      }}
                      className={cn(
                        "w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                        credentialsSaved 
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/10 active:scale-95" 
                          : "bg-white text-zinc-400 border border-zinc-200 cursor-not-allowed"
                      )}
                    >
                      Complete Onboarding
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleAddEmployee} className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Full Name</label>
                      <div className="relative group">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary-400 transition-colors" />
                        <input 
                          required 
                          type="text" 
                          placeholder="John Doe" 
                          value={newEmployeeData.name} 
                          onChange={(e) => { 
                            setNewEmployeeData({...newEmployeeData, name: e.target.value}); 
                            setFormErrors({...formErrors, name: ''}); 
                          }} 
                          className={cn(
                            "w-full pl-11 pr-4 py-3.5 rounded-2xl border bg-zinc-100 transition-all text-sm font-medium text-navy-900 placeholder:text-zinc-450 focus:outline-none focus:ring-2",
                            formErrors.name
                              ? "border-red-300 focus:ring-red-500/30"
                              : newEmployeeData.name.trim().length >= 3
                                ? "border-emerald-300 focus:ring-emerald-500/30"
                                : "border-zinc-200 focus:ring-primary-500/20"
                          )} 
                        />
                      </div>
                      {formErrors.name && (
                        <p className="text-[10px] text-red-500 font-semibold mt-1 ml-1">{formErrors.name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary-400 transition-colors" />
                        <input 
                          required 
                          type="email" 
                          placeholder="john@primetek.com" 
                          value={newEmployeeData.email} 
                          onChange={(e) => { 
                            setNewEmployeeData({...newEmployeeData, email: e.target.value}); 
                            setFormErrors({...formErrors, email: ''}); 
                          }} 
                          className={cn(
                            "w-full pl-11 pr-4 py-3.5 rounded-2xl border bg-zinc-100 transition-all text-sm font-medium text-navy-900 placeholder:text-zinc-450 focus:outline-none focus:ring-2",
                            formErrors.email
                              ? "border-red-300 focus:ring-red-500/30"
                              : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmployeeData.email)
                                ? "border-emerald-300 focus:ring-emerald-500/30"
                                : "border-zinc-200 focus:ring-primary-500/20"
                          )} 
                        />
                      </div>
                      {formErrors.email && (
                        <p className="text-[10px] text-red-500 font-semibold mt-1 ml-1">{formErrors.email}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">User Role</label>
                        <select value={newEmployeeData.role} onChange={(e) => setNewEmployeeData({...newEmployeeData, role: e.target.value})} className="w-full px-4 py-3.5 rounded-2xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 focus:ring-2 focus:ring-primary-500/20 focus:outline-none uppercase cursor-pointer appearance-none">
                          <option value="employee">Employee</option>
                          <option value="admin">Admin</option>
                          <option value="hr">HR Specialist</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Role / Department</label>
                        <div className="relative group">
                          <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary-400 transition-colors z-10" />
                          <select 
                            required 
                            value={newEmployeeData.department} 
                            onChange={(e) => {
                              const dept = e.target.value;
                              let autoRole = 'employee';
                              if (dept === 'Talent Acquisition Specialist') {
                                autoRole = 'hr';
                              }
                              setNewEmployeeData({
                                ...newEmployeeData, 
                                department: dept,
                                role: autoRole
                              });
                              setFormErrors({...formErrors, department: ''});
                            }} 
                            className={cn(
                              "w-full pl-11 pr-10 py-3.5 rounded-2xl border bg-white text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 cursor-pointer appearance-none",
                              formErrors.department
                                ? "border-red-300 focus:ring-red-500/30"
                                : newEmployeeData.department
                                  ? "border-emerald-300 focus:ring-emerald-500/30"
                                  : "border-zinc-200 focus:ring-primary-500/20"
                            )}
                          >
                            <option value="" disabled>Select Role...</option>
                            <option value="Talent Acquisition Specialist">Talent Acquisition Specialist</option>
                            <option value="Marketing Manager">Marketing Manager</option>
                            <option value="Bench Sales Executive">Bench Sales Executive</option>
                            <option value="Marketing Executive">Marketing Executive</option>
                            <option value="Team Lead">Team Lead</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px]">
                            ▼
                          </div>
                        </div>
                        {formErrors.department && (
                          <p className="text-[10px] text-red-500 font-semibold mt-1 ml-1">{formErrors.department}</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black rounded-2xl py-4 shadow-lg shadow-primary-500/10 border-0 active:scale-98 transition-all"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Plus className="w-5 h-5" />
                            <span>Onboard & Generate Credentials</span>
                          </div>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Balance Management Modal (Dark first) */}
      <AnimatePresence>
        {isBalanceModalOpen && selectedEmployee && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] border border-zinc-200 shadow-2xl w-full max-w-md overflow-hidden relative text-zinc-600"
            >
              <div className="flex items-center justify-between px-10 py-6 border-b border-zinc-200 bg-zinc-50/40">
                <div>
                  <h3 className="font-bold text-lg text-navy-900 tracking-tight">Leave Balance</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{selectedEmployee.name}</p>
                </div>
                <button 
                  onClick={() => setIsBalanceModalOpen(false)} 
                  className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-navy-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateBalances} className="p-8 space-y-6">
                <div className="space-y-4">
                  {[
                    { key: 'casual', label: 'Casual Leave Allocation (Current Month)' },
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{field.label}</label>
                      <input 
                        type="number" 
                        min={0}
                        max={10}
                        value={(balances as any)[field.key]} 
                        onChange={(e) => setBalances({...balances, [field.key]: parseInt(e.target.value) || 0})}
                        className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all text-sm font-black text-navy-900"
                      />
                    </div>
                  ))}
                </div>

                <Button 
                  type="submit" 
                  disabled={isUpdatingBalance}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black rounded-xl py-3.5 shadow-lg shadow-primary-500/10 border-0 active:scale-98 transition-all"
                >
                  {isUpdatingBalance ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Update Balance'}
                </Button>
              </form>
            </motion.div>
          </div>
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
