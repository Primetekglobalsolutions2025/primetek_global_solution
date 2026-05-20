'use client';

import { useState } from 'react';
import { 
  Eye, Download, Mail, Globe, 
  Phone, MapPin, Briefcase, GraduationCap, 
  FileText, X, CheckCircle2, Loader2 
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { updateProfileStatus } from './actions';
import { useToast } from '@/components/ui/Toast';

interface ClientProfile {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_role: string;
  client_address: string;
  client_linkedin: string;
  education_details: { bachelors: string; masters: string };
  assigned_to: string;
  resume_url: string;
  status: string;
}

export default function AssignedProfilesClient({ initialProfiles }: { initialProfiles: ClientProfile[] }) {
  const [profiles, setProfiles] = useState<ClientProfile[]>(initialProfiles);
  const [selectedProfile, setSelectedProfile] = useState<ClientProfile | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const { toast } = useToast();

  const handleStatusChange = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await updateProfileStatus(id, status);
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      toast.success('Profile status updated successfully.');
      if (selectedProfile?.id === id) {
        setSelectedProfile({...selectedProfile, status});
      }
    } catch (err) {
      toast.error('Failed to update status.');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-navy-900 tracking-tight">My Assignments</h1>
        <p className="text-text-muted text-xs">Review and process your assigned client profiles.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.length === 0 ? (
          <div className="md:col-span-2 text-center py-12 bg-white rounded-xl border border-dashed border-border/80">
            <Briefcase className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-25" />
            <p className="text-xs text-text-secondary font-medium">No profiles assigned to you yet.</p>
          </div>
        ) : (
          profiles.map(profile => (
            <Card key={profile.id} className="p-4 rounded-xl border border-border/60 shadow-sm bg-white" hover={false}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-navy-900 text-sm tracking-tight">{profile.client_name}</h3>
                  <p className="text-[10px] text-primary-600 font-bold uppercase tracking-wider mt-0.5">{profile.client_role}</p>
                </div>
                <button 
                  onClick={() => setSelectedProfile(profile)}
                  className="p-1.5 hover:bg-surface-alt rounded-lg text-primary-500 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 mb-4 text-xs">
                <div className="flex items-center gap-2.5 text-text-secondary">
                  <Mail className="w-3.5 h-3.5 text-text-muted" />
                  <span>{profile.client_email}</span>
                </div>
                <div className="flex items-center gap-2.5 text-text-secondary">
                  <Phone className="w-3.5 h-3.5 text-text-muted" />
                  <span>{profile.client_phone}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <select 
                  value={profile.status}
                  onChange={(e) => handleStatusChange(profile.id, e.target.value)}
                  disabled={updating === profile.id}
                  className="text-[10px] font-semibold uppercase tracking-wider py-1 px-2 rounded border border-border/60 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
                >
                  <option value="assigned">Assigned</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
                
                {profile.resume_url && (
                  <a 
                    href={profile.resume_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:underline"
                  >
                    <Download className="w-3 h-3" /> Resume
                  </a>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Detail View Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 cursor-pointer" onClick={() => setSelectedProfile(null)}>
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-border/60 px-4 py-3 flex justify-between items-center z-10">
              <h2 className="text-base font-bold text-navy-900">Client Profile View</h2>
              <button onClick={() => setSelectedProfile(null)} className="p-1.5 hover:bg-surface-alt rounded-lg text-text-muted cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-lg font-semibold shrink-0">
                  {selectedProfile.client_name?.[0]}
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-navy-900 tracking-tight">{selectedProfile.client_name}</h3>
                  <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider">{selectedProfile.client_role}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                    <a href={`mailto:${selectedProfile.client_email}`} className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary-600 transition-colors">
                      <Mail className="w-3.5 h-3.5 text-text-muted" /> {selectedProfile.client_email}
                    </a>
                    <a href={`tel:${selectedProfile.client_phone}`} className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary-600 transition-colors">
                      <Phone className="w-3.5 h-3.5 text-text-muted" /> {selectedProfile.client_phone}
                    </a>
                    {selectedProfile.client_linkedin && (
                      <a href={selectedProfile.client_linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary-600 transition-colors">
                        <Globe className="w-3.5 h-3.5 text-text-muted" /> LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Education */}
                <div className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    <GraduationCap className="w-4 h-4" /> Education
                  </h4>
                  <div className="bg-surface-alt/70 rounded-lg p-3 space-y-3 border border-border/40">
                    <div>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Master's Degree</p>
                      <p className="text-xs font-semibold text-navy-900 mt-0.5">{selectedProfile.education_details?.masters || 'Not specified'}</p>
                    </div>
                    <div className="pt-2.5 border-t border-border/60">
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Bachelor's Degree</p>
                      <p className="text-xs font-semibold text-navy-900 mt-0.5">{selectedProfile.education_details?.bachelors || 'Not specified'}</p>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    <MapPin className="w-4 h-4" /> Location & Files
                  </h4>
                  <div className="space-y-3 bg-surface-alt/70 rounded-lg p-3 border border-border/40">
                    <div>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Address</p>
                      <p className="text-xs font-semibold text-text-secondary leading-relaxed mt-0.5">{selectedProfile.client_address || 'No address provided'}</p>
                    </div>
                    {selectedProfile.resume_url && (
                      <div className="pt-1">
                        <a 
                          href={selectedProfile.resume_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <Button variant="outline" className="w-full text-xs py-1.5 rounded-lg border-border/60 font-semibold bg-white cursor-pointer active:scale-98 transition-transform">
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Download DOCX Resume
                          </Button>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Update */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Current Status</p>
                  <p className="text-xs font-bold text-navy-900 capitalize">{selectedProfile.status}</p>
                </div>
                <div className="flex gap-2">
                  {selectedProfile.status !== 'completed' && (
                    <Button onClick={() => handleStatusChange(selectedProfile.id, 'completed')} disabled={updating === selectedProfile.id} className="bg-navy-900 hover:bg-navy-800 text-white rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm active:scale-95 transition-all">
                      {updating === selectedProfile.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                      Mark as Completed
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
