'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Edit2, Briefcase, MapPin, Clock, DollarSign } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { toggleJobActive } from './actions';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  salary_range?: string | null;
  is_active: boolean;
  created_at: string;
}

interface JobsClientProps {
  initialJobs: Job[];
}

export default function JobsClient({ initialJobs }: JobsClientProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [search, setSearch] = useState('');

  const filtered = jobs.filter((job) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return job.title.toLowerCase().includes(q) || job.department.toLowerCase().includes(q);
  });

  const handleToggle = async (id: string, currentStatus: boolean) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, is_active: !currentStatus } : job))
    );
    try {
      await toggleJobActive(id, currentStatus);
    } catch {
      setJobs((prev) =>
        prev.map((job) => (job.id === id ? { ...job, is_active: currentStatus } : job))
      );
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full max-w-sm group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary-500 transition-colors" />
          <input
            type="text"
            placeholder="Filter by title or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-border/60 bg-white text-sm text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm"
          />
        </div>
        <Link href="/admin/jobs/new" className="w-full sm:w-auto">
          <Button className="w-full bg-navy-900 hover:bg-navy-800 text-white rounded-2xl px-6 py-3 font-bold shadow-xl shadow-navy-900/10 active:scale-95 transition-all">
            <Plus className="w-4 h-4 mr-2" /> Create Listing
          </Button>
        </Link>
      </div>

      {/* 2. Content Grid (Using Table for structure, but with premium styling) */}
      <Card hover={false} className="p-0 overflow-hidden border border-border/60 rounded-[2rem] shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-alt/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Opportunity</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Function</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Environment</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Publication</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Visibility</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((job) => (
                <tr key={job.id} className="group hover:bg-surface-alt/30 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-500 group-hover:bg-primary-500 group-hover:text-white transition-all">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-navy-900 tracking-tight group-hover:text-primary-600 transition-colors">{job.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <DollarSign className="w-3 h-3 text-emerald-500" />
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{job.salary_range || 'Competitive'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <span className="text-[11px] font-black text-navy-900 uppercase tracking-widest bg-surface-alt px-2.5 py-1 rounded-lg">
                      {job.department}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-text-secondary">
                        <MapPin className="w-3 h-3 text-red-400" />
                        <span className="text-[11px] font-bold">{job.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-text-muted">
                        <Clock className="w-3 h-3" />
                        <span className="text-[10px] font-medium capitalize">{job.type}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="text-[11px] font-bold text-text-muted">
                      {formatDate(job.created_at)}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <button
                      onClick={() => handleToggle(job.id, job.is_active)}
                      className="flex items-center gap-3 active:scale-95 transition-transform group/toggle"
                    >
                      <div className={cn(
                        "w-10 h-5 rounded-full relative transition-colors duration-300",
                        job.is_active ? "bg-emerald-500" : "bg-gray-200"
                      )}>
                        <div className={cn(
                          "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm",
                          job.is_active ? "left-6" : "left-1"
                        )} />
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        job.is_active ? "text-emerald-600" : "text-gray-400"
                      )}>
                        {job.is_active ? 'Public' : 'Hidden'}
                      </span>
                    </button>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <Link 
                      href={`/admin/jobs/${job.id}/edit`}
                      className="inline-flex w-9 h-9 rounded-xl text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-all items-center justify-center active:scale-90"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
                      <Briefcase className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-sm text-text-muted font-bold">No vacancy listings currently exist.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
