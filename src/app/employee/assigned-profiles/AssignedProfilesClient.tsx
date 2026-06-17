'use client';

import { useState, useRef } from 'react';
import { 
  Eye, Download, Mail, Globe, 
  Phone, MapPin, Briefcase, GraduationCap, 
  X
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { updateProfileStatus } from './actions';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import InterviewRequestModal from './InterviewRequestModal';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';
import { typography } from '@/styles/design-system';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [requestProfile, setRequestProfile] = useState<ClientProfile | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(modalRef, !!selectedProfile, () => setSelectedProfile(null));

  const { toast } = useToast();

  const handleStatusChange = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await updateProfileStatus(id, status);
      if (res && res.success) {
        setProfiles(prev => prev.map(p => p.id === id ? { ...p, status } : p));
        toast.success('Profile status updated successfully.');
        if (selectedProfile?.id === id) {
          setSelectedProfile({...selectedProfile, status});
        }
      } else {
        toast.error(res?.error || 'Failed to update status.');
      }
    } catch {
      toast.error('Failed to update status.');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4 pb-8 font-sans">
      <div>
        <h1 className={typography.pageTitle}>My Assignments</h1>
        <p className="text-zinc-450 text-xs mt-0.5">Review and process your assigned client profiles.</p>
      </div>

      {/* Mobile Card List Layout */}
      <div className="block md:hidden space-y-3">
        {profiles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-zinc-250">
            <Briefcase className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-25" />
            <p className="text-xs text-zinc-500 font-medium">No profiles assigned to you yet.</p>
          </div>
        ) : (
          profiles.map(profile => (
            <div key={profile.id} className="p-4 rounded-lg border border-zinc-200 border-t-2 border-t-primary-500/80 shadow-2xs bg-white transition-all hover:-translate-y-0.5 hover:shadow-xs">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-navy-900 text-sm tracking-tight">{profile.client_name}</h3>
                  <p className="text-[10px] text-primary-600 font-mono font-semibold uppercase tracking-wider mt-0.5">{profile.client_role}</p>
                </div>
                <button 
                  onClick={() => setSelectedProfile(profile)}
                  className="p-1.5 hover:bg-zinc-50 rounded border border-zinc-200 text-primary-500 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 mb-4 text-xs">
                <div className="flex items-center gap-2.5 text-zinc-600">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{profile.client_email}</span>
                </div>
                <div className="flex items-center gap-2.5 text-zinc-600">
                  <Phone className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{profile.client_phone}</span>
                </div>
                {profile.resume_url && (
                  <div className="pt-2 border-t border-dashed border-zinc-100 mt-2">
                    <a 
                      href={profile.resume_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (!window.confirm('Are you sure you want to download the Consultant Resume?')) {
                          e.preventDefault();
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Consultant Resume
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-100 gap-2">
                <select 
                  value={(profile.status || 'assigned').toLowerCase()}
                  onChange={(e) => handleStatusChange(profile.id, e.target.value)}
                  disabled={updating === profile.id}
                  className={cn(
                    "text-[10px] font-mono font-semibold uppercase tracking-wider py-1.5 px-2 rounded border focus:outline-none focus:ring-2 focus:ring-primary-400/50 cursor-pointer transition-all duration-200 flex-1 min-w-0 max-w-[130px]",
                    (profile.status || 'assigned').toLowerCase() === 'assigned' && "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/75",
                    (profile.status || 'assigned').toLowerCase() === 'processing' && "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100/75",
                    (profile.status || 'assigned').toLowerCase() === 'completed' && "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/75",
                    (profile.status || 'assigned').toLowerCase() === 'rejected' && "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/75"
                  )}
                >
                  <option value="assigned" className="bg-white text-navy-900 font-sans">Assigned</option>
                  <option value="processing" className="bg-white text-navy-900 font-sans">Processing</option>
                  <option value="completed" className="bg-white text-navy-900 font-sans">Completed</option>
                  <option value="rejected" className="bg-white text-navy-900 font-sans">Rejected</option>
                </select>

                <Button 
                  size="sm"
                  onClick={() => {
                    setRequestProfile(profile);
                    setIsRequestModalOpen(true);
                  }}
                  className="bg-navy-900 hover:bg-navy-800 text-white text-[10px] py-1.5 px-3 rounded-md font-semibold shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                >
                  Request Interview
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table Layout */}
      <div className="p-0 overflow-hidden border border-zinc-200 border-t-3 border-t-primary-500 shadow-sm bg-white hidden md:block rounded-lg transition-all hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-4 py-3 font-heading font-semibold text-xs tracking-wider text-navy-800 uppercase">Client Profile</th>
                <th className="px-4 py-3 font-heading font-semibold text-xs tracking-wider text-navy-800 uppercase">Contact Details</th>
                <th className="px-4 py-3 font-heading font-semibold text-xs tracking-wider text-navy-800 uppercase">Status</th>
                <th className="px-4 py-3 font-heading font-semibold text-xs tracking-wider text-navy-800 uppercase">Resume</th>
                <th className="px-4 py-3 text-right font-heading font-semibold text-xs tracking-wider text-navy-800 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150">
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Briefcase className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-25" />
                    <p className="text-xs text-zinc-500 font-medium">No profiles assigned to you yet.</p>
                  </td>
                </tr>
              ) : (
                profiles.map(profile => (
                  <tr key={profile.id} className="hover:bg-zinc-50/50 transition-all group">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-navy-900 tracking-tight text-xs">{profile.client_name}</p>
                        <p className="text-[10px] text-primary-600 font-mono font-semibold uppercase tracking-wider mt-0.5">{profile.client_role}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 text-xs text-zinc-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-zinc-400" />
                          <span>{profile.client_email}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-zinc-400" />
                          <span>{profile.client_phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select 
                        value={(profile.status || 'assigned').toLowerCase()}
                        onChange={(e) => handleStatusChange(profile.id, e.target.value)}
                        disabled={updating === profile.id}
                        className={cn(
                          "text-[10px] font-mono font-semibold uppercase tracking-wider py-1.5 px-2.5 rounded border focus:outline-none focus:ring-2 focus:ring-primary-400/50 cursor-pointer transition-all duration-200",
                          (profile.status || 'assigned').toLowerCase() === 'assigned' && "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/75",
                          (profile.status || 'assigned').toLowerCase() === 'processing' && "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100/75",
                          (profile.status || 'assigned').toLowerCase() === 'completed' && "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/75",
                          (profile.status || 'assigned').toLowerCase() === 'rejected' && "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/75"
                        )}
                      >
                        <option value="assigned" className="bg-white text-navy-900 font-sans">Assigned</option>
                        <option value="processing" className="bg-white text-navy-900 font-sans">Processing</option>
                        <option value="completed" className="bg-white text-navy-900 font-sans">Completed</option>
                        <option value="rejected" className="bg-white text-navy-900 font-sans">Rejected</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {profile.resume_url ? (
                        <a 
                          href={profile.resume_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (!window.confirm('Are you sure you want to download the Consultant Resume?')) {
                              e.preventDefault();
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" /> Resume
                        </a>
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-mono">No resume</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          size="sm"
                          onClick={() => {
                            setRequestProfile(profile);
                            setIsRequestModalOpen(true);
                          }}
                          className="bg-navy-900 hover:bg-navy-800 text-white text-[10px] py-1.5 px-2.5 rounded-md font-semibold shadow-sm cursor-pointer"
                        >
                          Request Interview
                        </Button>
                        <button 
                          onClick={() => setSelectedProfile(profile)}
                          className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 text-primary-500 transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail View Modal */}
      <AnimatePresence>
        {selectedProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4 cursor-pointer" onClick={() => setSelectedProfile(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.3 }}
              ref={modalRef} 
              className="bg-white rounded-xl w-full max-w-3xl max-h-[90dvh] overflow-y-auto shadow-xl border border-zinc-200 cursor-default" 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-zinc-200 px-4 py-3 flex justify-between items-center z-10">
                <h2 className="text-base font-bold text-navy-900">Client Profile View</h2>
                <button onClick={() => setSelectedProfile(null)} className="p-1.5 hover:bg-zinc-100 rounded border border-zinc-200 text-zinc-400 cursor-pointer transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Header Info */}
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="w-10 h-10 rounded bg-primary-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-3xs">
                    {selectedProfile.client_name?.[0]}
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-navy-900 tracking-tight">{selectedProfile.client_name}</h3>
                    <p className="text-[10px] font-mono font-semibold text-primary-600 uppercase tracking-wider">{selectedProfile.client_role}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                      <a href={`mailto:${selectedProfile.client_email}`} className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-primary-600 transition-colors">
                        <Mail className="w-3.5 h-3.5 text-zinc-400" /> {selectedProfile.client_email}
                      </a>
                      <a href={`tel:${selectedProfile.client_phone}`} className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-primary-600 transition-colors">
                        <Phone className="w-3.5 h-3.5 text-zinc-400" /> {selectedProfile.client_phone}
                      </a>
                      {selectedProfile.client_linkedin && (
                        <a href={selectedProfile.client_linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-primary-600 transition-colors">
                          <Globe className="w-3.5 h-3.5 text-zinc-400" /> LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Education */}
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                      <GraduationCap className="w-3.5 h-3.5" /> Education
                    </h4>
                    <div className="bg-zinc-50 rounded-lg p-3 space-y-3 border border-zinc-200">
                      <div>
                        <p className="text-[9px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Master&apos;s Degree</p>
                        <p className="text-xs font-semibold text-navy-900 mt-0.5">{selectedProfile.education_details?.masters || 'Not specified'}</p>
                      </div>
                      <div className="pt-2.5 border-t border-zinc-150">
                        <p className="text-[9px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Bachelor&apos;s Degree</p>
                        <p className="text-xs font-semibold text-navy-900 mt-0.5">{selectedProfile.education_details?.bachelors || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                      <MapPin className="w-3.5 h-3.5" /> Location & Files
                    </h4>
                    <div className="space-y-3 bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <div>
                        <p className="text-[9px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Address</p>
                        <p className="text-xs font-semibold text-zinc-600 leading-relaxed mt-0.5">{selectedProfile.client_address || 'No address provided'}</p>
                      </div>
                      {selectedProfile.resume_url && (
                        <div className="pt-1">
                          <a 
                            href={selectedProfile.resume_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              if (!window.confirm('Are you sure you want to download the Consultant Resume?')) {
                                e.preventDefault();
                              }
                            }}
                            className="block"
                          >
                            <Button variant="outline" className="w-full text-xs py-1.5 rounded-md border-zinc-200 font-semibold bg-white cursor-pointer active:scale-98 transition-transform">
                              <Download className="w-3.5 h-3.5 mr-1.5" /> Download DOCX Resume
                            </Button>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Update */}
                <div className="pt-4 border-t border-zinc-200 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Current Status</p>
                    <span className={cn(
                      "inline-flex items-center text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-1 rounded border mt-1",
                      selectedProfile.status === 'assigned' && "bg-blue-50 text-blue-700 border-blue-200",
                      selectedProfile.status === 'processing' && "bg-violet-50 text-violet-700 border-violet-200",
                      selectedProfile.status === 'completed' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                      selectedProfile.status === 'rejected' && "bg-red-50 text-red-700 border-red-200"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 shrink-0",
                        selectedProfile.status === 'assigned' && "bg-blue-500",
                        selectedProfile.status === 'processing' && "bg-violet-500",
                        selectedProfile.status === 'completed' && "bg-emerald-500",
                        selectedProfile.status === 'rejected' && "bg-red-500"
                      )} />
                      {selectedProfile.status}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => {
                        setRequestProfile(selectedProfile);
                        setIsRequestModalOpen(true);
                      }}
                      className="bg-navy-900 hover:bg-navy-800 text-white rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm active:scale-95 transition-all cursor-pointer font-sans"
                    >
                      Request Interview
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {requestProfile && (
        <InterviewRequestModal
          profile={requestProfile}
          isOpen={isRequestModalOpen}
          onClose={() => {
            setIsRequestModalOpen(false);
            setRequestProfile(null);
          }}
          onSubmitSuccess={() => {
            setRequestProfile(null);
            setIsRequestModalOpen(false);
            setSelectedProfile(null);
          }}
        />
      )}
    </div>
  );
}
