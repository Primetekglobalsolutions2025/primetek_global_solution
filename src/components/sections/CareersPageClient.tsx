'use client';

import { useState, useMemo } from 'react';
import { SearchX } from 'lucide-react';
import JobFilters from '@/components/sections/JobFilters';
import JobCard from '@/components/sections/JobCard';

export interface PublicJob {
  id: string;
  title: string;
  description: string;
  department: string;
  location: string;
  type: string;
  is_active: boolean;
  created_at: string;
}

export default function CareersPageClient({ initialJobs }: { initialJobs: PublicJob[] }) {
  const [filters, setFilters] = useState({
    search: '',
    department: 'All',
    location: 'All',
    type: 'all',
  });

  const filtered = useMemo(() => {
    return initialJobs.filter((job) => {
      if (!job.is_active) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !job.title.toLowerCase().includes(q) &&
          !job.description.toLowerCase().includes(q) &&
          !job.department.toLowerCase().includes(q)
        )
          return false;
      }

      if (filters.department !== 'All' && job.department !== filters.department) return false;
      if (filters.location !== 'All' && job.location !== filters.location) return false;
      if (filters.type !== 'all' && job.type !== filters.type) return false;

      return true;
    });
  }, [initialJobs, filters]);

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-navy-900 to-navy-800">
        <div className="container-wide text-center">
          <span className="inline-block text-primary-300 font-semibold text-sm uppercase tracking-widest mb-3">
            Careers
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 max-w-4xl mx-auto">
            Join the Team That Builds Teams
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Explore exciting opportunities at Primetek Global Solutions and our client organizations.
          </p>
        </div>
      </section>

      {/* Job Listings */}
      <section className="section-padding bg-surface-alt">
        <div className="container-wide">
          {/* Filters */}
          <div className="mb-8">
            <JobFilters onFiltersChange={setFilters} />
          </div>

          {/* Results Header */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-navy-900">{filtered.length}</span>{' '}
              {filtered.length === 1 ? 'opening' : 'openings'} found
            </p>
          </div>

          {/* Job Cards */}
          {filtered.length > 0 ? (
            <div className="space-y-4">
              {filtered.map((job, index) => (
                <JobCard key={job.id} job={job} index={index} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <SearchX className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-heading font-bold text-navy-900 mb-2">
                No openings match your criteria
              </h3>
              <p className="text-text-secondary text-sm">
                Try adjusting your filters or check back later for new positions.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
