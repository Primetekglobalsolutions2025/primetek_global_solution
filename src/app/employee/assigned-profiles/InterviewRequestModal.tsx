'use client';

import { useState, useRef } from 'react';
import { X, Loader2, Building, FileUp } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { submitInterviewRequest } from './actions';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

interface ClientProfile {
  id: string;
  client_name: string;
  client_phone: string;
  client_role: string;
  resume_url: string;
}

interface InterviewRequestModalProps {
  profile: ClientProfile;
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

export default function InterviewRequestModal({
  profile,
  isOpen,
  onClose,
  onSubmitSuccess
}: InterviewRequestModalProps) {
  const { toast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(modalRef, isOpen, onClose);

  const [submitting, setSubmitting] = useState(false);
  const [clientCompany, setClientCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [interviewDatetime, setInterviewDatetime] = useState('');
  const [interviewPlatform, setInterviewPlatform] = useState('Zoom');
  const [resumeType, setResumeType] = useState<'original' | 'updated'>('original');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be under 2MB.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext || '')) {
      toast.error('Only PDF, DOC, or DOCX formats are supported.');
      return;
    }
    setSelectedFile(file);
  };

  const handleJdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('JD document size must be under 2MB.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'docx') {
      toast.error('Only DOCX format is supported for Job Description (JD) document.');
      return;
    }
    setJdFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientCompany.trim()) {
      toast.error('Please enter the Client/Company name.');
      return;
    }
    if (!jobTitle.trim()) {
      toast.error('Please enter the Job Title.');
      return;
    }
    if (!interviewDatetime) {
      toast.error('Please specify the Interview Date and Time.');
      return;
    }
    if (resumeType === 'updated' && !selectedFile) {
      toast.error('Please select an updated resume file to upload.');
      return;
    }
    if (!jdFile) {
      toast.error('Please select a Job Description (JD) document (.docx only).');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('profile_id', profile.id);
      formData.append('client_company', clientCompany);
      formData.append('job_title', jobTitle);
      formData.append('interview_datetime', interviewDatetime);
      formData.append('interview_platform', interviewPlatform);
      formData.append('resume_type', resumeType);

      if (resumeType === 'updated' && selectedFile) {
        formData.append('resume', selectedFile);
      }
      if (jdFile) {
        formData.append('jd', jdFile);
      }

      const result = await submitInterviewRequest(formData);
      if (result && result.success) {
        toast.success('Interview request sent to Admin successfully!');
        if (onSubmitSuccess) onSubmitSuccess();
        onClose();
      } else {
        toast.error(result?.error || 'Failed to submit interview request.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to submit interview request.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = 'w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-navy-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 hover:border-zinc-350 transition-all text-xs font-semibold shadow-2xs';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 cursor-pointer"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      tabIndex={-1}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-xl w-full max-w-md max-h-[90dvh] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 cursor-default border-t-3 border-t-primary-500"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-4 py-3 flex justify-between items-center z-10">
          <h2 className="text-sm font-heading font-bold text-navy-900 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-primary-500" />
            <span>Request Support Interview</span>
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-zinc-50 rounded-lg text-zinc-400 cursor-pointer transition-colors border border-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          {/* Form Fields */}
          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="font-bold text-navy-900 block">Client / Company Name *</label>
              <input 
                type="text" 
                placeholder="e.g. JPMorgan Chase & Co." 
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                className={inputClasses}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-navy-900 block">Job Title *</label>
              <input 
                type="text" 
                placeholder="e.g. Senior Frontend Engineer" 
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className={inputClasses}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-navy-900 block">Interview Date & Time (EST) *</label>
              <input 
                type="datetime-local" 
                value={interviewDatetime}
                onChange={(e) => setInterviewDatetime(e.target.value)}
                className={inputClasses}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-navy-900 block">Interview Platform *</label>
              <select 
                value={interviewPlatform}
                onChange={(e) => setInterviewPlatform(e.target.value)}
                className={inputClasses}
              >
                <option value="Zoom">Zoom</option>
                <option value="MS Teams">Microsoft Teams</option>
                <option value="Google Meet">Google Meet</option>
                <option value="Webex">Cisco Webex</option>
                <option value="Phone Interview">Phone Interview</option>
                <option value="Skype">Skype</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Job Description (JD) Option */}
            <div className="space-y-2 pt-1.5 border-t border-border/80">
              <label className="font-bold text-navy-900 block">Job Description (JD) * (.docx only)</label>
              <div className="border border-dashed border-border rounded-xl p-3 bg-zinc-50 flex items-center justify-center gap-3 relative min-h-[50px] transition-all">
                <input 
                  type="file" 
                  accept=".docx"
                  onChange={handleJdFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  required
                />
                <FileUp className="w-4 h-4 text-text-muted shrink-0" />
                <div className="text-left leading-normal">
                  <span className="font-semibold block text-[10px] text-navy-900">
                    {jdFile ? jdFile.name : 'Select JD file'}
                  </span>
                  <span className="text-[9px] text-text-muted block">
                    {jdFile ? `${(jdFile.size / 1024).toFixed(1)} KB` : 'DOCX only (Max 2MB)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Resume Option */}
            <div className="space-y-2 pt-1.5 border-t border-border/80">
              <label className="font-bold text-navy-900 block">Resume For Interview *</label>
              
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-text-secondary">
                  <input 
                    type="radio" 
                    name="resumeType" 
                    checked={resumeType === 'original'}
                    onChange={() => {
                      setResumeType('original');
                      setSelectedFile(null);
                    }}
                    className="accent-primary-500 cursor-pointer"
                  />
                  <span>Use Original Resume</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-text-secondary">
                  <input 
                    type="radio" 
                    name="resumeType" 
                    checked={resumeType === 'updated'}
                    onChange={() => setResumeType('updated')}
                    className="accent-primary-500 cursor-pointer"
                  />
                  <span>Upload Updated Resume</span>
                </label>
              </div>

              {resumeType === 'updated' && (
                <div className="mt-2 border border-dashed border-border rounded-xl p-3 bg-zinc-50 flex items-center justify-center gap-3 relative min-h-[50px] transition-all">
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <FileUp className="w-4 h-4 text-text-muted shrink-0" />
                  <div className="text-left leading-normal">
                    <span className="font-semibold block text-[10px] text-navy-900">
                      {selectedFile ? selectedFile.name : 'Select updated resume file'}
                    </span>
                    <span className="text-[9px] text-text-muted block">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'PDF, DOCX, or DOC (Max 2MB)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitting}
              className="px-5 py-1.5 text-xs font-semibold rounded-lg bg-primary-500 hover:bg-primary-600 text-white cursor-pointer active:scale-95"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <span>Send Request</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
