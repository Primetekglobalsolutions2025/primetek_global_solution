'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Clock, ArrowRight, IndianRupee } from 'lucide-react';

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  salary_range?: string | null;
  created_at: string;
  description?: string;
  is_active?: boolean;
}

interface JobCardProps {
  job: Job;
  index: number;
}

const typeColors: Record<string, string> = {
  'full-time': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  contract: 'bg-amber-50 text-amber-600 border-amber-200',
  remote: 'bg-blue-50 text-blue-600 border-blue-200',
  'part-time': 'bg-violet-50 text-violet-600 border-violet-200',
};

const typeLabels: Record<string, string> = {
  'full-time': 'Full-time',
  contract: 'Contract',
  remote: 'Remote',
  'part-time': 'Part-time',
};

export default function JobCard({ job, index }: JobCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link
        href={`/careers/${job.id}`}
        className="block bg-white rounded-xl border border-border p-6 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 group"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-heading font-bold text-navy-900 group-hover:text-primary-500 transition-colors">
              {job.title}
            </h3>
            <p className="text-sm text-text-secondary mt-1">{job.department}</p>
          </div>
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${typeColors[job.type]}`}>
            {typeLabels[job.type]}
          </span>
        </div>

        <p className="text-sm text-text-secondary leading-relaxed mb-4 line-clamp-2">
          {job.description}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4" /> {job.location}
          </span>
          {job.salary_range && (
            <span className="flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4" /> {job.salary_range}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> {new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
          <span className="ml-auto flex items-center gap-1 text-primary-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Apply <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
