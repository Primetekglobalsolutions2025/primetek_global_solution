import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Clock, Briefcase, IndianRupee, Building } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ApplicationForm from '@/components/sections/ApplicationForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  
  const { data: job } = await supabaseAdmin
    .from('jobs')
    .select('title, department, location')
    .eq('id', id)
    .single();

  if (!job) return { title: 'Job Not Found' };
  
  return {
    title: job.title,
    description: `Apply for ${job.title} at Primetek Global Solutions. ${job.department} | ${job.location}`,
  };
}

const typeLabels: Record<string, string> = {
  'full-time': 'Full-time',
  contract: 'Contract',
  remote: 'Remote',
  'part-time': 'Part-time',
};

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  
  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !job) notFound();

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-12 bg-gradient-to-b from-navy-900 to-navy-800">
        <div className="container-wide">
          <Link
            href="/careers"
            className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Careers
          </Link>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            {job.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-300 text-sm">
            <span className="flex items-center gap-1.5">
              <Building className="w-4 h-4 text-primary-400" /> {job.department}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary-400" /> {job.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-primary-400" /> {typeLabels[job.type] || job.type}
            </span>
            {job.salary_range && (
              <span className="flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-primary-400" /> {job.salary_range}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary-400" />{' '}
              Posted {new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
            {/* Job Details */}
            <div className="lg:col-span-3 space-y-8">
              <div>
                <h2 className="text-xl font-heading font-bold text-navy-900 mb-4">About This Role</h2>
                <p className="text-text-secondary leading-relaxed">{job.description}</p>
              </div>

              <div>
                <h2 className="text-xl font-heading font-bold text-navy-900 mb-4">Requirements</h2>
                <div className="space-y-2">
                  {job.requirements.split('\n').map((req: string, i: number) => (
                    <p key={i} className="text-text-secondary leading-relaxed">{req}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* Application Form */}
            <div className="lg:col-span-2">
              <div className="bg-surface-alt rounded-2xl p-6 md:p-8 border border-border sticky top-24">
                <h2 className="text-xl font-heading font-bold text-navy-900 mb-2">
                  Apply for This Role
                </h2>
                <p className="text-text-secondary text-sm mb-6">
                  Fill in your details and upload your resume.
                </p>
                <ApplicationForm jobId={job.id} jobTitle={job.title} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
