'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface JobFiltersProps {
  onFiltersChange: (filters: {
    search: string;
    department: string;
    location: string;
    type: string;
  }) => void;
}

const departments = ['All', 'Information Technology', 'Healthcare', 'Banking & Finance', 'Manufacturing', 'Retail & E-Commerce'];
const locations = ['All', 'Hyderabad', 'Bangalore', 'Remote'];
const jobTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'full-time', label: 'Full-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'remote', label: 'Remote' },
  { value: 'part-time', label: 'Part-time' },
];

export default function JobFilters({ onFiltersChange }: JobFiltersProps) {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [location, setLocation] = useState('All');
  const [type, setType] = useState('all');

  const updateFilters = (updates: Record<string, string>) => {
    const newState = { search, department, location, type, ...updates };
    if (updates.search !== undefined) setSearch(updates.search);
    if (updates.department !== undefined) setDepartment(updates.department);
    if (updates.location !== undefined) setLocation(updates.location);
    if (updates.type !== undefined) setType(updates.type);
    onFiltersChange(newState);
  };

  const hasActiveFilters = search || department !== 'All' || location !== 'All' || type !== 'all';

  return (
    <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
        <input
          type="text"
          placeholder="Search jobs by title, keyword, or department..."
          value={search}
          onChange={(e) => updateFilters({ search: e.target.value })}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-surface-alt text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm"
        />
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={department}
          onChange={(e) => updateFilters({ department: e.target.value })}
          className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          {departments.map((d) => (
            <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>
          ))}
        </select>

        <select
          value={location}
          onChange={(e) => updateFilters({ location: e.target.value })}
          className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          {locations.map((l) => (
            <option key={l} value={l}>{l === 'All' ? 'All Locations' : l}</option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => updateFilters({ type: e.target.value })}
          className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          {jobTypes.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearch('');
              setDepartment('All');
              setLocation('All');
              setType('all');
              onFiltersChange({ search: '', department: 'All', location: 'All', type: 'all' });
            }}
            className="px-4 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:bg-surface-alt transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
