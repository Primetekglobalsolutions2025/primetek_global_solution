'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ClipboardCheck, Loader2, Calendar, FileText, 
  CheckCircle2, AlertCircle, Plus, Minus
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { submitDailyMetrics } from './actions';
import { typography } from '@/styles/design-system';

interface Profile {
  id: string;
  client_name: string;
  created_at: string;
  status: string;
}

interface Metric {
  profile_id: string;
  applications_count: number;
  interviews_count: number;
  assessments: number;
  technical_rounds: number;
  non_technical: number;
  self_submissions: number;
  support_submissions: number;
}

interface HistoryItem {
  id: string;
  profile_id: string;
  report_date: string;
  applications_count: number;
  interviews_count: number;
  assessments: number;
  technical_rounds: number;
  non_technical: number;
  self_submissions: number;
  support_submissions: number;
  created_at: string;
  application_profiles: any;
}

interface DailyReportClientProps {
  profiles: Profile[];
  todayMetrics: Metric[];
  history: HistoryItem[];
  reportDate: string;
}

export default function DailyReportClient({ profiles, todayMetrics, history, reportDate }: DailyReportClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Track which profiles are selected for submission today (default to checked if already submitted today)
  const [checkedProfiles, setCheckedProfiles] = useState<Record<string, boolean>>(() => {
    return profiles.reduce((acc, p) => {
      acc[p.id] = todayMetrics.some(m => m.profile_id === p.id);
      return acc;
    }, {} as Record<string, boolean>);
  });

  // Initialize values for all assigned profiles
  const [formValues, setFormValues] = useState<Record<string, Record<string, number>>>(() => {
    return profiles.reduce((acc, p) => {
      const metric = todayMetrics.find(m => m.profile_id === p.id);
      acc[p.id] = {
        applications_count: metric ? metric.applications_count : 0,
        interviews_count: metric ? metric.interviews_count : 0,
        assessments: metric ? metric.assessments : 0,
        technical_rounds: metric ? metric.technical_rounds : 0,
        non_technical: metric ? metric.non_technical : 0,
        self_submissions: metric ? metric.self_submissions : 0,
        support_submissions: metric ? metric.support_submissions : 0,
      };
      return acc;
    }, {} as Record<string, Record<string, number>>);
  });

  const handleInputChange = (profileId: string, field: string, value: number) => {
    const safeVal = Math.max(0, isNaN(value) ? 0 : value);
    setFormValues(prev => ({
      ...prev,
      [profileId]: {
        ...prev[profileId],
        [field]: safeVal
      }
    }));
  };

  const handleIncrement = (profileId: string, field: string) => {
    const current = formValues[profileId]?.[field] || 0;
    handleInputChange(profileId, field, current + 1);
  };

  const handleDecrement = (profileId: string, field: string) => {
    const current = formValues[profileId]?.[field] || 0;
    handleInputChange(profileId, field, current - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProfileIds = Object.keys(checkedProfiles).filter(id => checkedProfiles[id]);
    if (selectedProfileIds.length === 0) {
      toast.error('Please select at least one client profile to submit report.');
      return;
    }

    setSubmitting(true);

    try {
      const entries = selectedProfileIds.map(profileId => {
        const values = formValues[profileId] || {
          applications_count: 0,
          interviews_count: 0,
          assessments: 0,
          technical_rounds: 0,
          non_technical: 0,
          self_submissions: 0,
          support_submissions: 0
        };
        return {
          profile_id: profileId,
          applications_count: values.applications_count,
          interviews_count: values.interviews_count,
          assessments: values.assessments,
          technical_rounds: values.technical_rounds,
          non_technical: values.non_technical,
          self_submissions: values.self_submissions,
          support_submissions: values.support_submissions,
        };
      });

      const res = await submitDailyMetrics(entries);
      if (res && res.success) {
        toast.success(todayMetrics.length > 0 ? 'Selected daily reports updated successfully!' : 'Selected daily reports submitted successfully!');
        router.refresh();
      } else {
        toast.error(res?.error || 'Failed to submit daily report. Please try again.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit daily report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isAlreadySubmitted = todayMetrics.length > 0;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
  };

  // Group history by date
  const groupedHistory = history.reduce((acc, item) => {
    const date = item.report_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, HistoryItem[]>);

  return (
    <div className="space-y-6 pb-12 font-sans" data-testid="daily-reports-page">
      {/* Header section with state */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 md:p-6 rounded-lg border border-zinc-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary-500" />
            <h1 className={typography.pageTitle}>Daily Recruitment Report</h1>
          </div>
          <p className="text-xs text-zinc-450">
            Report your daily client staffing metrics. Filled daily per consultant profile.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-50 text-navy-800 rounded border border-zinc-200 text-[10px] font-mono font-medium uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-zinc-450" />
            <span>Today: {formatDate(reportDate)}</span>
          </div>

          {isAlreadySubmitted ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-250 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Submitted</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono font-medium bg-amber-50 text-amber-700 border border-amber-250 uppercase tracking-wider animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Pending</span>
            </div>
          )}
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-zinc-250">
          <ClipboardCheck className="w-10 h-10 text-zinc-400 mx-auto mb-3 opacity-30" />
          <h3 className="font-semibold text-navy-900 text-sm mb-1">No Active Profiles</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            You currently have no active or processing profiles assigned to you. Daily reporting is only required for active assignments.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-hidden bg-white rounded-lg border border-zinc-200 shadow-2xs relative">
            <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              <span>Metric Entry Matrix</span>
              <span className="flex items-center gap-1 text-primary-500 font-semibold tracking-wider normal-case animate-pulse">
                ↔ Swipe horizontally to view all columns
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-semibold text-navy-955 uppercase tracking-wider font-heading">
                    <th className="p-3 text-center w-16">Report</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Assign Date</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Consultant Name</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px] text-center w-28 bg-zinc-100/50">Apps Count</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px] text-center w-28 bg-zinc-100/50">Interviews</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px] text-center w-28">Assessments</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px] text-center w-28">Tech Rounds</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px] text-center w-28">Non-Tech</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px] text-center w-28 bg-primary-50/50 text-primary-750 font-bold">Self (Own)</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px] text-center w-28 bg-primary-50/50 text-primary-750 font-bold">Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150">
                  {profiles.map(profile => {
                    const values = formValues[profile.id] || {
                      applications_count: 0,
                      interviews_count: 0,
                      assessments: 0,
                      technical_rounds: 0,
                      non_technical: 0,
                      self_submissions: 0,
                      support_submissions: 0
                    };
                    const isChecked = !!checkedProfiles[profile.id];
                    const isSubmittedToday = todayMetrics.some(m => m.profile_id === profile.id);

                    return (
                      <tr key={profile.id} className={`hover:bg-zinc-50/50 transition-colors ${!isChecked ? 'bg-zinc-50/20' : ''}`}>
                        {/* Checkbox Column */}
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => setCheckedProfiles(prev => ({ ...prev, [profile.id]: e.target.checked }))}
                            className="w-4 h-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-4 text-zinc-500 font-mono whitespace-nowrap">
                          {formatDate(profile.created_at)}
                        </td>
                        <td className="p-4 font-semibold text-navy-900">
                          <div className="flex flex-col gap-1.5">
                            <span className={!isChecked ? 'text-zinc-400' : ''}>{profile.client_name}</span>
                            <div>
                              {isSubmittedToday ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-150 uppercase tracking-wider">
                                  Submitted
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-150 uppercase tracking-wider">
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Applications */}
                        <td className={`p-3 bg-zinc-50/30 transition-opacity duration-200 ${isChecked ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleDecrement(profile.id, 'applications_count')}
                              aria-label={`Decrease applications count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              disabled={!isChecked}
                              value={values.applications_count}
                              onChange={(e) => handleInputChange(profile.id, 'applications_count', parseInt(e.target.value))}
                              className="w-14 text-center py-1 px-1 border border-zinc-200 rounded-md focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 font-mono text-xs text-navy-900 bg-white disabled:bg-zinc-50 disabled:text-zinc-450"
                            />
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleIncrement(profile.id, 'applications_count')}
                              aria-label={`Increase applications count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        {/* Interviews */}
                        <td className={`p-3 bg-zinc-50/30 transition-opacity duration-200 ${isChecked ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleDecrement(profile.id, 'interviews_count')}
                              aria-label={`Decrease interviews count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              disabled={!isChecked}
                              value={values.interviews_count}
                              onChange={(e) => handleInputChange(profile.id, 'interviews_count', parseInt(e.target.value))}
                              className="w-14 text-center py-1 px-1 border border-zinc-200 rounded-md focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 font-mono text-xs text-navy-900 bg-white disabled:bg-zinc-50 disabled:text-zinc-450"
                            />
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleIncrement(profile.id, 'interviews_count')}
                              aria-label={`Increase interviews count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        {/* Assessments */}
                        <td className={`p-3 transition-opacity duration-200 ${isChecked ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleDecrement(profile.id, 'assessments')}
                              aria-label={`Decrease assessments count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              disabled={!isChecked}
                              value={values.assessments}
                              onChange={(e) => handleInputChange(profile.id, 'assessments', parseInt(e.target.value))}
                              className="w-14 text-center py-1 px-1 border border-zinc-200 rounded-md focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 font-mono text-xs text-navy-900 bg-white disabled:bg-zinc-50 disabled:text-zinc-450"
                            />
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleIncrement(profile.id, 'assessments')}
                              aria-label={`Increase assessments count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        {/* Tech Rounds */}
                        <td className={`p-3 transition-opacity duration-200 ${isChecked ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleDecrement(profile.id, 'technical_rounds')}
                              aria-label={`Decrease technical rounds count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              disabled={!isChecked}
                              value={values.technical_rounds}
                              onChange={(e) => handleInputChange(profile.id, 'technical_rounds', parseInt(e.target.value))}
                              className="w-14 text-center py-1 px-1 border border-zinc-200 rounded-md focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 font-mono text-xs text-navy-900 bg-white disabled:bg-zinc-50 disabled:text-zinc-450"
                            />
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleIncrement(profile.id, 'technical_rounds')}
                              aria-label={`Increase technical rounds count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        {/* Non-Tech */}
                        <td className={`p-3 transition-opacity duration-200 ${isChecked ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleDecrement(profile.id, 'non_technical')}
                              aria-label={`Decrease non-technical rounds count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              disabled={!isChecked}
                              value={values.non_technical}
                              onChange={(e) => handleInputChange(profile.id, 'non_technical', parseInt(e.target.value))}
                              className="w-14 text-center py-1 px-1 border border-zinc-200 rounded-md focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 font-mono text-xs text-navy-900 bg-white disabled:bg-zinc-50 disabled:text-zinc-450"
                            />
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleIncrement(profile.id, 'non_technical')}
                              aria-label={`Increase non-technical rounds count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        {/* Self */}
                        <td className={`p-3 bg-primary-50/30 transition-opacity duration-200 ${isChecked ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleDecrement(profile.id, 'self_submissions')}
                              aria-label={`Decrease self submissions count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-primary-50 rounded border border-primary-100 bg-primary-55/50 text-primary-700 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              disabled={!isChecked}
                              value={values.self_submissions}
                              onChange={(e) => handleInputChange(profile.id, 'self_submissions', parseInt(e.target.value))}
                              className="w-14 text-center py-1 px-1 border border-primary-200 rounded-md focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 font-mono text-xs text-primary-900 font-bold bg-white disabled:bg-zinc-50 disabled:text-zinc-450"
                            />
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleIncrement(profile.id, 'self_submissions')}
                              aria-label={`Increase self submissions count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-primary-50 rounded border border-primary-100 bg-primary-55/50 text-primary-700 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        {/* Support */}
                        <td className={`p-3 bg-primary-50/30 transition-opacity duration-200 ${isChecked ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleDecrement(profile.id, 'support_submissions')}
                              aria-label={`Decrease support submissions count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-primary-50 rounded border border-primary-100 bg-primary-55/50 text-primary-700 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              disabled={!isChecked}
                              value={values.support_submissions}
                              onChange={(e) => handleInputChange(profile.id, 'support_submissions', parseInt(e.target.value))}
                              className="w-14 text-center py-1 px-1 border border-primary-200 rounded-md focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 font-mono text-xs text-primary-900 font-bold bg-white disabled:bg-zinc-50 disabled:text-zinc-450"
                            />
                            <button
                              type="button"
                              disabled={!isChecked}
                              onClick={() => handleIncrement(profile.id, 'support_submissions')}
                              aria-label={`Increase support submissions count for ${profile.client_name}`}
                              className="p-1.5 hover:bg-primary-50 rounded border border-primary-100 bg-primary-55/50 text-primary-700 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile / Tablet Responsive Cards */}
          <div className="lg:hidden space-y-4">
            {profiles.map(profile => {
              const values = formValues[profile.id] || {
                applications_count: 0,
                interviews_count: 0,
                assessments: 0,
                technical_rounds: 0,
                non_technical: 0,
                self_submissions: 0,
                support_submissions: 0
              };
              const isChecked = !!checkedProfiles[profile.id];
              const isSubmittedToday = todayMetrics.some(m => m.profile_id === profile.id);

              return (
                <div key={profile.id} className="bg-white rounded-lg border border-zinc-200 shadow-2xs p-5 space-y-4">
                  <div className="flex justify-between items-start border-b border-zinc-100 pb-3 gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => setCheckedProfiles(prev => ({ ...prev, [profile.id]: e.target.checked }))}
                        className="w-4 h-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500 mt-0.5 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <h4 className="font-bold text-navy-900 text-sm font-sans break-words">{profile.client_name}</h4>
                        <p className="text-[10px] font-mono text-zinc-400 mt-0.5">ASSIGNED: {formatDate(profile.created_at)}</p>
                      </div>
                    </div>
                    {isSubmittedToday ? (
                      <span className="text-[9px] font-mono bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                        Submitted
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono bg-amber-50 border border-amber-250 text-amber-700 font-semibold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 animate-pulse">
                        Pending
                      </span>
                    )}
                  </div>

                  {isChecked && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Input columns */}
                        {[
                          { field: 'applications_count', label: 'Apps Count' },
                          { field: 'interviews_count', label: 'Interviews' },
                          { field: 'assessments', label: 'Assessments' },
                          { field: 'technical_rounds', label: 'Tech Rounds' },
                          { field: 'non_technical', label: 'Non-Tech' }
                        ].map(item => (
                          <div key={item.field} className="space-y-1">
                            <label className="text-[10px] font-semibold text-zinc-500 font-sans">{item.label}</label>
                            <div className="flex items-center justify-between border border-zinc-200 rounded-md py-1 px-2 bg-white">
                              <button
                                type="button"
                                onClick={() => handleDecrement(profile.id, item.field)}
                                className="p-1 hover:bg-zinc-100 rounded border border-zinc-100 bg-zinc-50 text-zinc-500"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={(values as any)[item.field]}
                                onChange={(e) => handleInputChange(profile.id, item.field, parseInt(e.target.value))}
                                className="w-full text-center border-0 p-0 focus:outline-none focus:ring-0 text-navy-900 font-semibold font-mono text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleIncrement(profile.id, item.field)}
                                className="p-1 hover:bg-zinc-100 rounded border border-zinc-100 bg-zinc-50 text-zinc-500"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Self & Support */}
                      <div className="grid grid-cols-2 gap-4 bg-primary-50/30 p-3 rounded-lg border border-primary-100/50">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-primary-800 uppercase tracking-wider">Self Submissions</label>
                          <div className="flex items-center justify-between border border-primary-200 bg-white rounded-md py-1 px-2">
                            <button
                              type="button"
                              onClick={() => handleDecrement(profile.id, 'self_submissions')}
                              className="p-1 hover:bg-primary-50 rounded border border-primary-105 bg-primary-50/50 text-primary-700"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={values.self_submissions}
                              onChange={(e) => handleInputChange(profile.id, 'self_submissions', parseInt(e.target.value))}
                              className="w-full text-center border-0 p-0 focus:outline-none focus:ring-0 text-primary-900 font-bold font-mono text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleIncrement(profile.id, 'self_submissions')}
                              className="p-1 hover:bg-primary-50 rounded border border-primary-105 bg-primary-50/50 text-primary-700"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-primary-800 uppercase tracking-wider">Support Submissions</label>
                          <div className="flex items-center justify-between border border-primary-200 bg-white rounded-md py-1 px-2">
                            <button
                              type="button"
                              onClick={() => handleDecrement(profile.id, 'support_submissions')}
                              className="p-1 hover:bg-primary-50 rounded border border-primary-105 bg-primary-50/50 text-primary-700"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={values.support_submissions}
                              onChange={(e) => handleInputChange(profile.id, 'support_submissions', parseInt(e.target.value))}
                              className="w-full text-center border-0 p-0 focus:outline-none focus:ring-0 text-primary-900 font-bold font-mono text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleIncrement(profile.id, 'support_submissions')}
                              className="p-1 hover:bg-primary-50 rounded border border-primary-105 bg-primary-50/50 text-primary-700"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-1.5 px-6 py-2 bg-primary-500 hover:bg-primary-650 font-bold text-white rounded-md shadow-sm transition-all active:scale-[0.98] min-h-[40px] text-xs font-sans w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>{isAlreadySubmitted ? 'Update Daily Report' : 'Submit Daily Report'}</span>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* History log collapsible section */}
      <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          className="flex justify-between items-center w-full p-4 font-bold text-navy-900 text-sm hover:bg-zinc-50 transition-colors font-sans"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-500" />
            <span>Recent Submission History (Past 7 Days)</span>
          </div>
          <span className="text-xs text-primary-600 font-semibold font-sans">
            {isHistoryExpanded ? 'Collapse' : 'Expand'}
          </span>
        </button>

        {isHistoryExpanded && (
          <div className="border-t border-zinc-150 p-4 space-y-4 font-sans bg-white">
            {Object.keys(groupedHistory).length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-4">No recent submission history found.</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedHistory).map(([date, items]) => (
                  <div key={date} className="space-y-2">
                    <h4 className="font-bold text-xs text-navy-900 flex items-center gap-1.5 bg-zinc-50 p-2 rounded border border-zinc-200 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-zinc-450" />
                      <span>{formatDate(date)}</span>
                    </h4>

                    <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
                      <table className="w-full border-collapse text-left text-[11px]">
                        <thead>
                          <tr className="bg-zinc-50/80 text-navy-955 border-b border-zinc-200 font-semibold text-[10px] uppercase tracking-wider font-heading">
                            <th className="p-2.5 font-semibold text-left">Consultant</th>
                            <th className="p-2.5 text-center font-semibold">Apps</th>
                            <th className="p-2.5 text-center font-semibold">Interviews</th>
                            <th className="p-2.5 text-center font-semibold">Assessments</th>
                            <th className="p-2.5 text-center font-semibold">Tech</th>
                            <th className="p-2.5 text-center font-semibold">Non-Tech</th>
                            <th className="p-2.5 text-center bg-primary-50/50 text-primary-850 font-bold">Self</th>
                            <th className="p-2.5 text-center bg-primary-50/50 text-primary-850 font-bold">Support</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-150 text-navy-900 font-mono">
                          {items.map(item => (
                            <tr key={item.id} className="hover:bg-zinc-50/30">
                              <td className="p-2.5 font-semibold font-sans text-xs">
                                {(Array.isArray(item.application_profiles) 
                                  ? item.application_profiles[0]?.client_name 
                                  : item.application_profiles?.client_name) || 'Deleted Consultant'}
                              </td>
                              <td className="p-2.5 text-center">{item.applications_count}</td>
                              <td className="p-2.5 text-center">{item.interviews_count}</td>
                              <td className="p-2.5 text-center">{item.assessments}</td>
                              <td className="p-2.5 text-center">{item.technical_rounds}</td>
                              <td className="p-2.5 text-center">{item.non_technical}</td>
                              <td className="p-2.5 text-center bg-primary-50/10 font-bold text-primary-800">{item.self_submissions}</td>
                              <td className="p-2.5 text-center bg-primary-50/10 font-bold text-primary-800">{item.support_submissions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
