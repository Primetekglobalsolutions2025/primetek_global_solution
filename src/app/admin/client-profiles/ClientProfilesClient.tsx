'use client';

import { useState, useMemo } from 'react';
import { 
  Search, Plus, UserPlus, Eye, 
  Trash2, Download, X, Mail, 
  Globe, Phone, MapPin, Briefcase, 
  GraduationCap, FileText, Loader2, FileUser 
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { createProfile, updateProfile, deleteProfile, uploadClientResume } from './actions';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-700',
  processing: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
  pending: 'bg-violet-100 text-violet-700',
};

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
  assigned_employee?: { id: string; name: string };
}

export default function ClientProfilesClient({ initialProfiles, employees }: { initialProfiles: ClientProfile[], employees: any[] }) {
  const [profiles, setProfiles] = useState<ClientProfile[]>(initialProfiles);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState('');

  const [formData, setFormData] = useState<ClientProfile>({
    client_name: '',
    client_email: '',
    client_phone: '',
    client_role: '',
    client_address: '',
    client_linkedin: '',
    education_details: { bachelors: '', masters: '' },
    assigned_to: '',
    resume_url: ''
  });

  const filtered = useMemo(() => {
    return profiles.filter(p => 
      p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.client_email?.toLowerCase().includes(search.toLowerCase())
    );
  }, [profiles, search]);

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
        resume_url: profile.resume_url || ''
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
        resume_url: ''
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
        window.location.reload(); 
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
    if (!confirm('Are you sure you want to delete this profile?')) return;
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
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-navy-900">Client Profiles</h1>
          <p className="text-text-secondary text-sm">Create and assign client profiles to employees.</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4" /> Add Profile
        </Button>
      </div>

      <div className="relative max-w-md group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary-500 transition-colors" />
        <input 
          type="text" 
          placeholder="Search profiles..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border/60 bg-white text-sm text-navy-900 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 && (
          <div className="col-span-full p-16 text-center bg-white rounded-xl border border-dashed border-border/60">
            <div className="w-14 h-14 rounded-full bg-surface-alt flex items-center justify-center mx-auto mb-4">
              <FileUser className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-bold text-navy-900 mb-1">No Client Profiles Found</p>
            <p className="text-xs text-text-muted font-medium">Create a new profile to get started, or adjust your search filter.</p>
          </div>
        )}
        {filtered.map(profile => (
          <Card key={profile.id} className="p-5 flex flex-col h-full border-t-4 border-t-primary-500 hover:shadow-md transition-all duration-200 group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-heading font-bold text-navy-900">{profile.client_name}</h3>
                <p className="text-xs text-primary-600 font-bold uppercase tracking-wider">{profile.client_role}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleOpenModal(profile)} className="p-1.5 hover:bg-surface-alt rounded-lg text-text-muted transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(profile.id!)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <Mail className="w-4 h-4 text-text-muted" />
                <span className="truncate">{profile.client_email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <UserPlus className="w-4 h-4 text-text-muted" />
                <span>Assigned to: <span className="font-medium text-navy-900">{profile.assigned_employee?.name || 'Unassigned'}</span></span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-border flex justify-between items-center">
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                statusColors[profile.status?.toLowerCase() || ''] || 'bg-blue-100 text-blue-700'
              )}>
                {profile.status || 'Pending'}
              </span>
              {profile.resume_url && (
                <a href={profile.resume_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-primary-600 flex items-center gap-1 hover:underline">
                  <Download className="w-3 h-3" /> DOCX Resume
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Profile Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-lg font-heading font-bold text-navy-900">
                {editingProfile ? 'Edit Profile' : 'New Client Profile'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-surface-alt rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-navy-900">Client Name</label>
                  <input required value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-border focus:ring-2 focus:ring-primary-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-navy-900">Email Address</label>
                  <input type="email" value={formData.client_email} onChange={e => setFormData({...formData, client_email: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-border focus:ring-2 focus:ring-primary-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-navy-900">Phone Number</label>
                  <input value={formData.client_phone} onChange={e => setFormData({...formData, client_phone: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-border focus:ring-2 focus:ring-primary-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-navy-900">Target Role</label>
                  <input value={formData.client_role} onChange={e => setFormData({...formData, client_role: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-border focus:ring-2 focus:ring-primary-400 focus:outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-navy-900">LinkedIn Profile URL</label>
                <input value={formData.client_linkedin} onChange={e => setFormData({...formData, client_linkedin: e.target.value})} placeholder="https://linkedin.com/in/..." className="w-full px-4 py-2 rounded-xl border border-border focus:ring-2 focus:ring-primary-400 focus:outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-navy-900">Physical Address</label>
                <textarea rows={2} value={formData.client_address} onChange={e => setFormData({...formData, client_address: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-border focus:ring-2 focus:ring-primary-400 focus:outline-none" />
              </div>

              <div className="bg-surface-alt p-4 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">Education Details</h3>
  { }
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-navy-900">Master&apos;s Degree</label>
  { }
                    <input value={formData.education_details.masters} onChange={e => setFormData({...formData, education_details: {...formData.education_details, masters: e.target.value}})} className="w-full px-3 py-2 rounded-lg border border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-navy-900">Bachelor&apos;s Degree</label>
                    <input value={formData.education_details.bachelors} onChange={e => setFormData({...formData, education_details: {...formData.education_details, bachelors: e.target.value}})} className="w-full px-3 py-2 rounded-lg border border-border" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-navy-900">Assign to Employee</label>
                <select value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-border focus:ring-2 focus:ring-primary-400 focus:outline-none">
                  <option value="">Unassigned</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-navy-900">Upload Resume (DOCX only, Max 1MB)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="file" 
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                    onChange={e => setResumeFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                  {formData.resume_url && !resumeFile && (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 shrink-0">
                      <FileText className="w-4 h-4" /> Existing file
                    </span>
                  )}
                </div>
                {resumeError && <p className="text-xs text-red-500 font-medium">{resumeError}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
