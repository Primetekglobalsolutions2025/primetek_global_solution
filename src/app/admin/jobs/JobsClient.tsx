'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ToggleLeft, ToggleRight, Edit2, Briefcase, MapPin, Clock, DollarSign, Sparkles } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { toggleJobActive } from './actions';
import { motion } from 'framer-motion';

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
    <div className="space-y-4">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full max-w-sm group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary-500 transition-colors" />
          <input
            type="text"
            placeholder="Filter by title or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border/60 bg-white text-xs text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm"
          />
        </div>
        <Link href="/admin/jobs/new" className="w-full sm:w-auto">
          <Button className="w-full bg-navy-900 hover:bg-navy-800 text-white rounded-lg px-4 py-2 text-xs font-semibold shadow active:scale-95 transition-all">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Listing
          </Button>
        </Link>
      </div>

      {/* 2. Content Grid */}
      {/* 2. Content Grid (Mobile cards & Desktop table) */}
      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-border/60">
            <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-2">
              <Briefcase className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-xs text-text-muted font-semibold">No vacancy listings currently exist.</p>
          </div>
        ) : (
          filtered.map((job) => (
            <Card key={job.id} hover={false} className="p-4 rounded-xl border border-border/60 shadow-sm bg-white">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-primary-50 flex items-center justify-center text-primary-500 shrink-0">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-navy-900 leading-tight">{job.title}</h4>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mt-0.5 block">{job.salary_range || 'Competitive'}</span>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-navy-900 bg-surface-alt px-1.5 py-0.5 rounded border border-border/50 uppercase tracking-wider">
                  {job.department}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 bg-surface-alt/40 p-2.5 rounded-lg text-[10px] mb-3">
                <div>
                  <span className="text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Location</span>
                  <span className="font-bold text-navy-900">{job.location}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Type / Posted</span>
                  <span className="font-bold text-navy-900 capitalize">{job.type} • {formatDate(job.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-3">
                <button
                  onClick={() => handleToggle(job.id, job.is_active)}
                  className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-text-secondary active:scale-95 transition-transform cursor-pointer"
                >
                  <div className={cn(
                    "w-7 h-4 rounded-full relative transition-colors duration-300",
                    job.is_active ? "bg-emerald-500" : "bg-gray-200"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm",
                      job.is_active ? "left-3.5" : "left-0.5"
                    )} />
                  </div>
                  <span className={job.is_active ? 'text-emerald-600' : 'text-gray-400'}>
                    {job.is_active ? 'Public' : 'Hidden'}
                  </span>
                </button>

                <Link 
                  href={`/admin/jobs/${job.id}/edit`}
                  className="p-1.5 rounded bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Listing</span>
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card hover={false} className="p-0 overflow-hidden border border-border/60 rounded-xl shadow-sm bg-white hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-alt/50">
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Opportunity</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Function</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Environment</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Publication</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Visibility</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((job) => (
                <tr key={job.id} className="group hover:bg-surface-alt/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-primary-50 flex items-center justify-center text-primary-500 group-hover:bg-primary-500 group-hover:text-white transition-all shrink-0">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-navy-900 tracking-tight group-hover:text-primary-600 transition-colors">{job.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <DollarSign className="w-3 h-3 text-emerald-500" />
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{job.salary_range || 'Competitive'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="text-[9px] font-bold text-navy-900 uppercase tracking-wider bg-surface-alt px-1.5 py-0.5 rounded">
                      {job.department}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-text-secondary">
                        <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                        <span className="text-[10px] font-semibold">{job.location}</span>
                      </div>
                      <div className="flex items-center gap-1 text-text-muted">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span className="text-[9px] font-medium capitalize">{job.type}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="text-[10px] font-semibold text-text-muted">
                      {formatDate(job.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleToggle(job.id, job.is_active)}
                      className="flex items-center gap-2 active:scale-95 transition-transform group/toggle cursor-pointer"
                    >
                      <div className={cn(
                        "w-8 h-4.5 rounded-full relative transition-colors duration-300",
                        job.is_active ? "bg-emerald-500" : "bg-gray-200"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all duration-300 shadow-sm",
                          job.is_active ? "left-4" : "left-0.5"
                        )} />
                      </div>
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-wider",
                        job.is_active ? "text-emerald-600" : "text-gray-400"
                      )}>
                        {job.is_active ? 'Public' : 'Hidden'}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link 
                      href={`/admin/jobs/${job.id}/edit`}
                      className="inline-flex w-6.5 h-6.5 rounded text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-all items-center justify-center active:scale-90"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-3">
                      <Briefcase className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-xs text-text-muted font-bold">No vacancy listings currently exist.</p>
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
