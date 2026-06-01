'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';
import { 
  Search, Plus, UserPlus, Edit, 
  Trash2, Download, X, Mail, 
  Globe, Phone, MapPin, Briefcase, 
  GraduationCap, FileText, Loader2, FileUser 
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { createProfile, updateProfile, deleteProfile, uploadClientResume } from './actions';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import StatusBadge from '@/components/ui/StatusBadge';

const IT_KEYWORDS = [
  'developer', 'engineer', 'architect', 'programmer', 'coder', 'analyst',
  'java', 'python', 'dot net', '.net', 'c#', 'c++', 'javascript', 'typescript',
  'react', 'angular', 'node', 'vue', 'frontend', 'backend', 'full stack', 'fullstack',
  'qa', 'tester', 'testing', 'devops', 'cloud', 'aws', 'azure', 'gcp', 'sap',
  'salesforce', 'oracle', 'database', 'db', 'sql', 'cyber', 'security', 'network',
  'sysadmin', 'administrator', 'scrum', 'tech', 'technology', 'ui', 'ux', 'design',
  'data scientist', 'machine learning', 'ai', 'support engineer'
];

export function getRoleCategory(roleStr?: string): 'IT' | 'Non-IT' {
  if (!roleStr) return 'Non-IT';
  const role = roleStr.toLowerCase();
  
  // Check if it matches any IT keywords
  const isIT = IT_KEYWORDS.some(keyword => role.includes(keyword));
  return isIT ? 'IT' : 'Non-IT';
}

export function getProfileCategory(profile: ClientProfile): 'IT' | 'Non-IT' {
  if (profile.role_category) return profile.role_category;
  return getRoleCategory(profile.client_role);
}

interface ClientProfile {
  id?: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_role: string;
  client_address: string;
  client_linkedin: string;
  education_details: { bachelors: string; masters: string };
  assigned_to: string;
  resume_url: string;
  status?: string;
  role_category?: 'IT' | 'Non-IT';
  assigned_employee?: { id: string; name: string };
}

const inputClasses = 'w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/20 transition-all text-xs font-semibold shadow-2xs';

export default function ClientProfilesClient({ initialProfiles, employees }: { initialProfiles: ClientProfile[], employees: any[] }) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ClientProfile[]>(initialProfiles);
  const [prevInitialProfiles, setPrevInitialProfiles] = useState(initialProfiles);
  if (initialProfiles !== prevInitialProfiles) {
    setPrevInitialProfiles(initialProfiles);
    setProfiles(initialProfiles);
  }
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchValue);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchValue]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [roleCategory, setRoleCategory] = useState<'all' | 'IT' | 'Non-IT'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(modalRef, isModalOpen, () => setIsModalOpen(false));
  const [editingProfile, setEditingProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ 
    message: string; 
    onConfirm: () => void;
    variant?: 'danger' | 'primary';
  } | null>(null);

  const [formData, setFormData] = useState<ClientProfile>({
    client_name: '',
    client_email: '',
    client_phone: '',
    client_role: '',
    client_address: '',
    client_linkedin: '',
    education_details: { bachelors: '', masters: '' },
    assigned_to: '',
    resume_url: '',
    status: 'assigned',
    role_category: 'IT'
  });

  const filtered = useMemo(() => {
    return profiles.filter(p => {
      // 1. Text Search matching Client Name, Client Email, Client Role, or Assigned Employee Name
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        !searchLower ||
        p.client_name?.toLowerCase().includes(searchLower) ||
        p.client_email?.toLowerCase().includes(searchLower) ||
        p.client_role?.toLowerCase().includes(searchLower) ||
        p.assigned_employee?.name?.toLowerCase().includes(searchLower);

      // 2. Employee Filter
      const matchesEmployee = !selectedEmployee || p.assigned_to === selectedEmployee;

      // 3. Role Category Filter
      let matchesCategory = true;
      if (roleCategory !== 'all') {
        const cat = getProfileCategory(p);
        matchesCategory = cat === roleCategory;
      }

      return matchesSearch && matchesEmployee && matchesCategory;
    });
  }, [profiles, search, selectedEmployee, roleCategory]);

  const handleOpenModal = (profile: ClientProfile | null = null) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        client_name: profile.client_name || '',
        client_email: profile.client_email || '',
        client_phone: profile.client_phone || '',
        client_role: profile.client_role || '',
        client_address: profile.client_address || '',
        client_linkedin: profile.client_linkedin || '',
        education_details: profile.education_details || { bachelors: '', masters: '' },
        assigned_to: profile.assigned_to || '',
        resume_url: profile.resume_url || '',
        status: (profile.status || 'assigned').toLowerCase(),
        role_category: profile.role_category || 'IT'
      });
    } else {
      setEditingProfile(null);
      setFormData({
        client_name: '',
        client_email: '',
        client_phone: '',
        client_role: '',
        client_address: '',
        client_linkedin: '',
        education_details: { bachelors: '', masters: '' },
        assigned_to: '',
        resume_url: '',
        status: 'assigned',
        role_category: 'IT'
      });
    }
    setResumeFile(null);
    setResumeError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResumeError('');
    
    let finalResumeUrl = formData.resume_url;

    try {
      if (resumeFile) {
        if (resumeFile.size > 1 * 1024 * 1024) {
          setResumeError('Resume file must be under 1MB');
          setLoading(false);
          return;
        }
        const fileExt = resumeFile.name.split('.').pop()?.toLowerCase();
        if (fileExt !== 'docx') {
          setResumeError('Only DOCX format is supported');
          setLoading(false);
          return;
        }

        const uploadData = new FormData();
        uploadData.append('resume', resumeFile);
        const res = await uploadClientResume(uploadData);
        if (res.error) {
          setResumeError(res.error);
          setLoading(false);
          return;
        }
        if (res.success) {
          finalResumeUrl = res.url;
        }
      }

      const profileToSave = { ...formData, resume_url: finalResumeUrl };

      if (editingProfile) {
        if (!editingProfile.id) return;
        const res = await updateProfile(editingProfile.id, profileToSave);
        if (res.error) {
          toast.error(res.error);
          setLoading(false);
          return;
        }
        setProfiles(prev => prev.map(p => p.id === editingProfile.id ? { ...p, ...profileToSave } : p));
        toast.success('Profile updated successfully.');
      } else {
        const res = await createProfile(profileToSave);
        if (res.error) {
          toast.error(res.error);
          setLoading(false);
          return;
        }
        toast.success('Profile created successfully.');
        router.refresh(); 
      }
   
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) {
      toast.error('Cannot delete profile: Profile ID is missing.');
      return;
    }
    setConfirmAction({
      message: 'Are you sure you want to delete this profile? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await deleteProfile(id);
          if (res && res.error) {
            toast.error(res.error);
            return;
          }
          setProfiles(prev => prev.filter(p => p.id !== id));
          toast.success('Profile deleted successfully.');
        } catch (err) {
          console.error('Delete handler failed:', err);
          toast.error('Failed to delete profile.');
        }
      }
    });
  };

  return (
    <div className="space-y-6 pb-12 text-zinc-650 font-sans">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-lg border border-zinc-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary-500" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Client Profiles</h1>
          </div>
          <p className="text-xs text-zinc-450">
            Create and assign client profiles to employees.
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} size="sm">
          <Plus className="w-3.5 h-3.5" /> Add Profile
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center bg-white p-4 rounded-lg border border-zinc-200 shadow-2xs">
        {/* Search Text */}
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search name, email, role, or employee..." 
            value={searchValue} 
            onChange={(e) => setSearchValue(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 rounded-md border border-zinc-200 bg-white text-xs font-semibold text-navy-900 placeholder:text-zinc-450 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/20 transition-all shadow-2xs"
          />
        </div>

        {/* Employee Select */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-navy-900 shrink-0">Employee:</label>
          <select 
            value={selectedEmployee} 
            onChange={(e) => setSelectedEmployee(e.target.value)} 
            className="px-3 py-1.5 rounded-md border border-zinc-200 bg-white text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer min-w-[140px] shadow-2xs"
          >
            <option value="">All Employees</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        {/* Role Category Select */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-navy-900 shrink-0">Category:</label>
          <select 
            value={roleCategory} 
            onChange={(e) => setRoleCategory(e.target.value as any)} 
            className="px-3 py-1.5 rounded-md border border-zinc-200 bg-white text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer min-w-[120px] shadow-2xs"
          >
            <option value="all">All Roles</option>
            <option value="IT">IT Roles</option>
            <option value="Non-IT">Non-IT Roles</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center bg-white">
            <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mx-auto mb-3">
              <FileUser className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-xs font-semibold text-navy-900 uppercase tracking-wider font-mono">No Client Profiles Found</p>
            <p className="text-[11px] text-zinc-450 mt-0.5">Create a new profile to get started, or adjust your search filter.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 text-zinc-650 border-b border-zinc-200">
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Client Details</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Contact Info</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Assigned Employee</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Status</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px]">Resume</th>
                    <th className="p-3 font-mono font-semibold uppercase tracking-wider text-[9px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150">
                  {filtered.map((profile) => {
                    const category = getProfileCategory(profile);
                    return (
                      <tr key={profile.id} className="hover:bg-zinc-50/50 transition-colors group text-zinc-600">
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-navy-900 tracking-tight font-sans">
                              {profile.client_name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[9px] font-mono font-semibold text-primary-750 uppercase tracking-wider">
                                {profile.client_role}
                              </span>
                              <span className={cn(
                                "text-[8px] px-1 rounded font-mono font-medium border uppercase tracking-wider",
                                category === 'IT' 
                                  ? "bg-blue-50 text-blue-700 border-blue-200" 
                                  : "bg-indigo-50 text-indigo-700 border-indigo-200"
                              )}>
                                {category}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap text-xs">
                          <div className="flex flex-col font-mono text-[10px] text-zinc-500">
                            <span>{profile.client_email || '—'}</span>
                            <span className="text-[9px] text-zinc-400">{profile.client_phone || '—'}</span>
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="text-xs font-semibold text-navy-900">
                            {profile.assigned_employee?.name || 'Unassigned'}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <StatusBadge status={profile.status || 'Pending'} className="text-[8px] px-2 py-0.5" />
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {profile.resume_url ? (
                            <a 
                              href={profile.resume_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => {
                                if (!window.confirm('Are you sure you want to download the candidate resume?')) {
                                  e.preventDefault();
                                }
                              }}
                              className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold text-primary-750 hover:text-primary-850 uppercase tracking-wider bg-primary-50/50 border border-primary-200/40 px-2.5 py-0.5 rounded transition-all"
                            >
                              <Download className="w-3 h-3" /> DOCX
                            </a>
                          ) : (
                            <span className="text-zinc-450 font-bold font-mono text-[10px]">—</span>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap text-right text-xs">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => handleOpenModal(profile)} className="p-1 hover:bg-zinc-100 rounded text-zinc-500 hover:text-navy-950 transition-colors cursor-pointer" title="Edit Profile">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(profile.id!)} className="p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors cursor-pointer" title="Delete Profile">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked List View */}
            <div className="block md:hidden divide-y divide-zinc-150">
              {filtered.map((profile) => {
                const category = getProfileCategory(profile);
                return (
                  <div key={profile.id} className="p-4 hover:bg-zinc-50/50 transition-colors space-y-3 text-zinc-650">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-navy-900">{profile.client_name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] font-mono font-semibold text-primary-750 uppercase tracking-wider">
                            {profile.client_role}
                          </span>
                          <span className={cn(
                            "text-[8px] px-1 rounded font-mono font-medium border uppercase tracking-wider",
                            category === 'IT' 
                              ? "bg-blue-50 text-blue-700 border-blue-200" 
                              : "bg-indigo-50 text-indigo-700 border-indigo-200"
                          )}>
                            {category}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleOpenModal(profile)} className="p-1 hover:bg-zinc-100 rounded text-zinc-500 hover:text-navy-950 transition-colors cursor-pointer">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(profile.id!)} className="p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-zinc-50/50 p-2.5 rounded border border-zinc-200/60 text-[10px]">
                      <div>
                        <span className="text-zinc-450 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Contact</span>
                        <span className="font-semibold text-navy-900 truncate block">{profile.client_email || '—'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-450 block mb-0.5 font-bold uppercase tracking-wider text-[8px]">Assigned Employee</span>
                        <span className="font-semibold text-navy-900 truncate block">{profile.assigned_employee?.name || 'Unassigned'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <StatusBadge status={profile.status || 'Pending'} className="text-[8px] px-2 py-0.5" />
                      {profile.resume_url && (
                        <a 
                          href={profile.resume_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => {
                            if (!window.confirm('Are you sure you want to download the candidate resume?')) {
                              e.preventDefault();
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold text-primary-750 hover:text-primary-850 uppercase tracking-wider"
                        >
                          <Download className="w-3.5 h-3.5" /> DOCX Resume
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Profile Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div ref={modalRef} className="bg-white rounded-lg w-full max-w-2xl max-h-[90dvh] overflow-y-auto shadow-xl border border-zinc-200 animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-white border-b border-zinc-200 px-5 py-3.5 flex justify-between items-center z-10">
              <h2 className="text-sm font-semibold text-navy-900">
                {editingProfile ? 'Edit Profile' : 'New Client Profile'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-zinc-100 rounded text-zinc-500 hover:text-navy-950 transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5 text-zinc-650">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Client Name</label>
                  <input required value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} className={inputClasses} />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Email Address</label>
                  <input type="email" value={formData.client_email} onChange={e => setFormData({...formData, client_email: e.target.value})} className={inputClasses} />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Phone Number</label>
                  <input value={formData.client_phone} onChange={e => setFormData({...formData, client_phone: e.target.value})} className={inputClasses} />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Target Role</label>
                  <input value={formData.client_role} onChange={e => setFormData({...formData, client_role: e.target.value})} className={inputClasses} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">LinkedIn Profile URL</label>
                <input value={formData.client_linkedin} onChange={e => setFormData({...formData, client_linkedin: e.target.value})} placeholder="https://linkedin.com/in/..." className={inputClasses} />
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Physical Address</label>
                <textarea rows={2} value={formData.client_address} onChange={e => setFormData({...formData, client_address: e.target.value})} className="w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/20 transition-all text-xs font-semibold shadow-2xs" />
              </div>

              <div className="bg-zinc-50 p-4 rounded-md border border-zinc-200/80 space-y-4">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-450">Education Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Master&apos;s Degree</label>
                    <input value={formData.education_details.masters} onChange={e => setFormData({...formData, education_details: {...formData.education_details, masters: e.target.value}})} className="w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Bachelor&apos;s Degree</label>
                    <input value={formData.education_details.bachelors} onChange={e => setFormData({...formData, education_details: {...formData.education_details, bachelors: e.target.value}})} className="w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Assign to Employee</label>
                  <select value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})} className="w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer">
                    <option value="">Unassigned</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Status</label>
                  <select value={(formData.status || 'assigned').toLowerCase()} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer">
                    <option value="assigned">Assigned</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Role Category</label>
                  <select value={formData.role_category || 'IT'} onChange={e => setFormData({...formData, role_category: e.target.value as any})} className="w-full px-3 py-2 rounded-md border border-zinc-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer">
                    <option value="IT">IT Role</option>
                    <option value="Non-IT">Non-IT Role</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-0.5">Upload Resume (DOCX only, Max 1MB)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="file" 
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                    onChange={e => setResumeFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-zinc-200 file:text-xs file:font-semibold file:bg-zinc-50 file:text-zinc-700 hover:file:bg-zinc-100 cursor-pointer"
                  />
                  {formData.resume_url && !resumeFile && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 shrink-0">
                      <FileText className="w-3.5 h-3.5" /> Existing file
                    </span>
                  )}
                </div>
                {resumeError && <p className="text-[10px] text-red-500 font-medium">{resumeError}</p>}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Profile'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
