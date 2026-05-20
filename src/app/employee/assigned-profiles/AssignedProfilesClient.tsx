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
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-heading font-bold text-navy-900">My Assignments</h1>
        <p className="text-text-secondary text-sm">Review and process your assigned client profiles.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {profiles.length === 0 ? (
          <div className="md:col-span-2 text-center py-12 bg-white rounded-2xl border border-dashed border-border">
            <Briefcase className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-20" />
            <p className="text-text-secondary">No profiles assigned to you yet.</p>
          </div>
        ) : (
          profiles.map(profile => (
            <Card key={profile.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-heading font-bold text-navy-900 text-lg">{profile.client_name}</h3>
                  <p className="text-sm text-primary-600 font-bold uppercase tracking-wider">{profile.client_role}</p>
                </div>
                <button 
                  onClick={() => setSelectedProfile(profile)}
                  className="p-2 hover:bg-surface-alt rounded-xl text-primary-500 transition-colors"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                  <Mail className="w-4 h-4 text-text-muted" />
                  <span>{profile.client_email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                  <Phone className="w-4 h-4 text-text-muted" />
                  <span>{profile.client_phone}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <select 
                  value={profile.status}
                  onChange={(e) => handleStatusChange(profile.id, e.target.value)}
                  disabled={updating === profile.id}
                  className="text-xs font-bold uppercase py-1 px-3 rounded-lg border border-border bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
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
                    className="flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" /> Resume
                  </a>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Detail View Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-heading font-bold text-navy-900">Client Profile View</h2>
              <button onClick={() => setSelectedProfile(null)} className="p-2 hover:bg-surface-alt rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-8">
              {/* Header Info */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-3xl font-bold shrink-0">
                  {selectedProfile.client_name?.[0]}
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-heading font-bold text-navy-900">{selectedProfile.client_name}</h3>
                  <p className="text-lg font-medium text-primary-600">{selectedProfile.client_role}</p>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <a href={`mailto:${selectedProfile.client_email}`} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-600 transition-colors">
                      <Mail className="w-4 h-4" /> {selectedProfile.client_email}
                    </a>
                    <a href={`tel:${selectedProfile.client_phone}`} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-600 transition-colors">
                      <Phone className="w-4 h-4" /> {selectedProfile.client_phone}
                    </a>
                    {selectedProfile.client_linkedin && (
                      <a href={selectedProfile.client_linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-600 transition-colors">
                        <Globe className="w-4 h-4" /> LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Education */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
                    <GraduationCap className="w-4 h-4" /> Education
                  </h4>
                  <div className="bg-surface-alt rounded-2xl p-4 space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-text-muted uppercase">Master's Degree</p>
                      <p className="text-sm font-medium text-navy-900">{selectedProfile.education_details?.masters || 'Not specified'}</p>
                    </div>
                    <div className="pt-3 border-t border-border">
                      <p className="text-[10px] font-bold text-text-muted uppercase">Bachelor's Degree</p>
                      <p className="text-sm font-medium text-navy-900">{selectedProfile.education_details?.bachelors || 'Not specified'}</p>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
                    <MapPin className="w-4 h-4" /> Location & Files
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-text-muted uppercase">Address</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{selectedProfile.client_address || 'No address provided'}</p>
                    </div>
                    {selectedProfile.resume_url && (
                      <div className="pt-4">
                        <a 
                          href={selectedProfile.resume_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <Button variant="outline" className="w-full">
                            <Download className="w-4 h-4 mr-2" /> Download DOCX Resume
                          </Button>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Update */}
              <div className="pt-6 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase mb-1">Current Status</p>
                  <p className="text-sm font-bold text-navy-900 capitalize">{selectedProfile.status}</p>
                </div>
                <div className="flex gap-2">
                  {selectedProfile.status !== 'completed' && (
                    <Button onClick={() => handleStatusChange(selectedProfile.id, 'completed')} disabled={updating === selectedProfile.id}>
                      {updating === selectedProfile.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
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
