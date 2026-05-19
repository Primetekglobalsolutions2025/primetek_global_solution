'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, ToggleLeft, ToggleRight, X, Loader2, Trash2, Users, ShieldCheck, Mail, Briefcase, Sparkles, Wallet } from 'lucide-react';
import Image from 'next/image';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { toggleEmployeeStatus, createEmployee, deleteEmployee } from './actions';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
}

export default function EmployeesClient({ initialEmployees }: { initialEmployees: EmployeeRecord[] }) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>(initialEmployees);
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEmployeeData, setNewEmployeeData] = useState({ name: '', email: '', role: 'employee', department: '' });
  const [successMessage, setSuccessMessage] = useState<{ id: string; pass: string } | null>(null);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);
  const [balances, setBalances] = useState({ sick: 0, casual: 0, earned: 0 });

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(e => e.status === 'Active').length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [employees]);

  const filtered = employees.filter((emp) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      emp.employee_id.toLowerCase().includes(q) ||
      (emp.department && emp.department.toLowerCase().includes(q))
    );
  });

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e)));
    
    try {
      await toggleEmployeeStatus(id, currentStatus);
    } catch (err) {
      setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, status: currentStatus } : e)));
      alert('Failed to update employee status');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    try {
      const res = await createEmployee(newEmployeeData);
      setSuccessMessage({ id: res.employee_id, pass: res.password });
      setTimeout(() => {
        window.location.reload();
      }, 8000); 
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message || 'Failed to create employee');
      } else {
        alert('Failed to create employee');
      }
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;

    try {
      await deleteEmployee(id);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert('Failed to delete employee');
    }
  };

  const handleOpenBalanceModal = async (emp: EmployeeRecord) => {
    setSelectedEmployee(emp);
    setIsBalanceModalOpen(true);
    // Fetch current balances
    try {
      const res = await fetch(`/api/admin/employees/${emp.id}/balances`);
      const data = await res.json();
      if (data.balances) {
        const b = data.balances;
        setBalances({
          sick: b.find((x: any) => x.leave_type === 'Sick')?.total_days || 0,
          casual: b.find((x: any) => x.leave_type === 'Casual')?.total_days || 0,
          earned: b.find((x: any) => x.leave_type === 'Earned')?.total_days || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch balances');
    }
  };

  const handleUpdateBalances = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setIsUpdatingBalance(true);
    try {
      const res = await fetch(`/api/admin/employees/${selectedEmployee.id}/balances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(balances),
      });
      if (!res.ok) throw new Error('Failed to update');
      alert('Balances updated successfully');
      setIsBalanceModalOpen(false);
    } catch (err) {
      alert('Failed to update balances');
    } finally {
      setIsUpdatingBalance(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-navy-900', bg: 'bg-white' },
          { label: 'Active', value: stats.active, icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-50/50' },
          { label: 'Inactive', value: stats.inactive, icon: X, color: 'text-red-500', bg: 'bg-red-50/50' },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-3xl p-4 border border-border/50 shadow-sm flex items-center gap-4", s.bg)}>
            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center bg-white shadow-sm", s.color)}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-black text-navy-900 leading-none">{s.value}</p>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full max-w-sm group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by ID, name, email..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-border/60 bg-white text-sm text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm" 
          />
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)} 
          className="w-full sm:w-auto bg-navy-900 hover:bg-navy-800 text-white rounded-2xl px-6 py-3 font-bold shadow-xl shadow-navy-900/10 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Employee
        </Button>
      </div>

      {/* 3. Employees Table */}
      <Card hover={false} className="p-0 overflow-hidden border border-border/60 rounded-[2rem] shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-alt/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Identity</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Staff ID</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Function</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-sm text-text-muted font-bold">No active personnel matching your query.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="group hover:bg-surface-alt/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          {emp.avatar_url ? (
                            <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-sm border border-border/50">
                              <Image src={emp.avatar_url} alt={emp.name} fill className="object-cover" sizes="44px" />
                            </div>
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-primary-500/20 ring-2 ring-white">
                              {emp.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className={cn(
                            "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm",
                            emp.status === 'Active' ? "bg-emerald-500" : "bg-gray-300"
                          )} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-navy-900 leading-tight group-hover:text-primary-600 transition-colors">{emp.name}</p>
                          <p className="text-[11px] text-text-muted font-medium mt-0.5">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-xs font-black text-navy-900 bg-surface-alt px-2.5 py-1 rounded-lg border border-border/50 uppercase tracking-tighter">
                        {emp.employee_id}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-navy-900 uppercase tracking-widest">{emp.role}</p>
                        <p className="text-[10px] text-text-muted font-medium">{emp.department || 'General'}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <button onClick={() => handleToggle(emp.id, emp.status)} className="flex items-center gap-3 active:scale-95 transition-transform group/toggle">
                        <div className={cn(
                          "w-10 h-5 rounded-full relative transition-colors duration-300",
                          emp.status === 'Active' ? "bg-emerald-500" : "bg-gray-200"
                        )}>
                          <div className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm",
                            emp.status === 'Active' ? "left-6" : "left-1"
                          )} />
                        </div>
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          emp.status === 'Active' ? "text-emerald-600" : "text-gray-400"
                        )}>{emp.status}</span>
                      </button>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenBalanceModal(emp)}
                          className="w-9 h-9 rounded-xl text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-all flex items-center justify-center active:scale-90"
                          title="Manage Balances"
                        >
                          <Wallet className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(emp.id, emp.name)}
                          className="w-9 h-9 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center active:scale-90"
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

      {/* 4. Premium Add Employee Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white/90 backdrop-blur-3xl rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 relative"
            >
              <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
                <Users className="w-48 h-48 text-navy-900" />
              </div>

              <div className="flex items-center justify-between px-10 py-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-primary-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">Employee Management</span>
                  </div>
                  <h3 className="font-heading font-black text-2xl text-navy-900 tracking-tight">Add New Employee</h3>
                </div>
                <button 
                  onClick={() => { setIsModalOpen(false); setSuccessMessage(null); }} 
                  className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center text-text-muted hover:text-navy-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="px-10 pb-10">
                {successMessage ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2.5rem] p-8 text-center space-y-6"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-heading font-black text-emerald-900 text-xl tracking-tight">Account Created</h4>
                      <p className="text-sm text-emerald-700/80 mt-2 font-medium">Please save these login credentials. The password is encrypted and cannot be retrieved later.</p>
                    </div>
                    
                    <div className="bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border border-emerald-100 text-left space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee ID</span>
                        <span className="text-sm font-black text-navy-900 font-mono bg-white px-3 py-1 rounded-lg">{successMessage.id}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Initial Password</span>
                        <span className="text-sm font-black text-primary-600 font-mono bg-white px-3 py-1 rounded-lg">{successMessage.pass}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Updating database...
                    </div>
                  </motion.div>
                ) : (
                  <form onSubmit={handleAddEmployee} className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Full Name</label>
                      <div className="relative group">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                        <input required type="text" placeholder="John Doe" value={newEmployeeData.name} onChange={(e) => setNewEmployeeData({...newEmployeeData, name: e.target.value})} className="w-full pl-11 pr-4 py-4 rounded-2xl bg-surface-alt border-0 focus:ring-2 focus:ring-primary-500/50 focus:bg-white transition-all text-sm font-medium text-navy-900" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                        <input required type="email" placeholder="john@primetek.com" value={newEmployeeData.email} onChange={(e) => setNewEmployeeData({...newEmployeeData, email: e.target.value})} className="w-full pl-11 pr-4 py-4 rounded-2xl bg-surface-alt border-0 focus:ring-2 focus:ring-primary-500/50 focus:bg-white transition-all text-sm font-medium text-navy-900" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">User Role</label>
                        <select value={newEmployeeData.role} onChange={(e) => setNewEmployeeData({...newEmployeeData, role: e.target.value})} className="w-full px-4 py-4 rounded-2xl bg-surface-alt border-0 focus:ring-2 focus:ring-primary-500/50 focus:bg-white transition-all text-sm font-black text-navy-900 uppercase">
                          <option value="employee">Employee</option>
                          <option value="admin">Admin</option>
                          <option value="hr">HR Specialist</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Department</label>
                        <div className="relative group">
                          <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                          <input required type="text" placeholder="Engineering" value={newEmployeeData.department} onChange={(e) => setNewEmployeeData({...newEmployeeData, department: e.target.value})} className="w-full pl-11 pr-4 py-4 rounded-2xl bg-surface-alt border-0 focus:ring-2 focus:ring-primary-500/50 focus:bg-white transition-all text-sm font-medium text-navy-900" />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black rounded-2xl py-5 shadow-xl shadow-primary-500/20 border-0 active:scale-98 transition-all"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Plus className="w-5 h-5" />
                            <span>Create Account</span>
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
      {/* 5. Balance Management Modal */}
      <AnimatePresence>
        {isBalanceModalOpen && selectedEmployee && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden border border-white/20 relative"
            >
              <div className="flex items-center justify-between px-10 py-8 border-b border-border/40">
                <div>
                  <h3 className="font-heading font-black text-xl text-navy-900 tracking-tight">Leave Balance</h3>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">{selectedEmployee.name}</p>
                </div>
                <button 
                  onClick={() => setIsBalanceModalOpen(false)} 
                  className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center text-text-muted hover:text-navy-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateBalances} className="p-10 space-y-6">
                <div className="space-y-4">
                  {[
                    { key: 'sick', label: 'Sick Leave Allocation' },
                    { key: 'casual', label: 'Casual Leave Allocation' },
                    { key: 'earned', label: 'Earned Leave Allocation' },
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{field.label}</label>
                      <input 
                        type="number" 
                        value={(balances as any)[field.key]} 
                        onChange={(e) => setBalances({...balances, [field.key]: parseInt(e.target.value) || 0})}
                        className="w-full px-5 py-4 rounded-2xl bg-surface-alt border-0 focus:ring-2 focus:ring-primary-500/50 transition-all text-sm font-black text-navy-900"
                      />
                    </div>
                  ))}
                </div>

                <Button 
                  type="submit" 
                  disabled={isUpdatingBalance}
                  className="w-full bg-navy-900 hover:bg-navy-800 text-white font-black rounded-2xl py-5 shadow-xl shadow-navy-900/10 border-0 active:scale-98 transition-all"
                >
                  {isUpdatingBalance ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Update Balances'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

