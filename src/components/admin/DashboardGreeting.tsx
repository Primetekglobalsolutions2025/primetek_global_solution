'use client';

import { motion } from 'framer-motion';
import { Shield, Settings, CheckSquare, MapPin } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';

interface DashboardGreetingProps {
  userName?: string;
  email?: string;
}

export default function DashboardGreeting({ userName, email }: DashboardGreetingProps) {
  const firstName = userName ? userName.split(' ')[0] : 'Admin';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-lg bg-navy-900 p-6 md:p-8 text-white shadow-md shadow-navy-900/15 mb-6"
    >
      {/* Subtle Decorative mesh highlights */}
      <div className="absolute top-[-25%] right-[-15%] w-[45%] h-[130%] bg-primary-500/15 rounded-full blur-[90px] animate-pulse" />
      <div className="absolute bottom-[-15%] left-[-5%] w-[35%] h-[90%] bg-emerald-500/5 rounded-full blur-[70px]" />
      
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-white/5 border border-white/10 shadow-inner font-mono text-[9px] font-medium uppercase tracking-wider text-primary-200">
            <span>Admin Portal</span>
          </div>
          
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-white font-sans">
              Welcome Back,<br />
              <span className="text-primary-400 brightness-110">{firstName}</span>
            </h1>
            <p className="text-zinc-400 text-xs mt-2.5 max-w-md font-medium leading-relaxed font-sans">
              Administrator Console. Monitor attendance telemetry, review pending disputes, manage team directories, and manage client profiles.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/admin/approvals">
              <Button className="bg-white text-navy-900 hover:bg-zinc-100 rounded-md px-4 py-2 text-xs font-semibold shadow-sm transition-all font-sans flex items-center group">
                <CheckSquare className="w-3.5 h-3.5 mr-2 group-hover:rotate-12 transition-transform text-navy-900" /> 
                Review Approvals
              </Button>
            </Link>
            <Link href="/admin/settings">
              <Button className="bg-transparent hover:bg-white/5 text-white border border-white/20 hover:border-white/40 rounded-md px-4 py-2 text-xs font-semibold transition-all font-sans flex items-center">
                System Settings <Settings className="w-3.5 h-3.5 ml-2 text-white" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Profile Card */}
        <div className="relative">
          <div className="bg-navy-950/40 rounded-lg p-5 border border-white/10 w-full lg:w-[280px] shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center text-primary-300">
                <Shield className="w-5 h-5 text-primary-300" />
              </div>
              <div className="text-right">
                <p className="text-[9px] font-mono font-medium text-zinc-400 uppercase tracking-wider">System Access</p>
                <p className="text-xs font-mono font-semibold text-white mt-0.5">ADMIN_OK</p>
              </div>
            </div>
            
            <div className="space-y-3 font-sans">
              <div>
                <p className="text-[9px] font-mono font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Control Scope</p>
                <p className="text-sm font-semibold text-white">Full Ecosystem</p>
              </div>
              <div>
                <p className="text-[9px] font-mono font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Active Account</p>
                <p className="text-xs font-semibold text-primary-200 truncate max-w-[240px]" title={email}>{email || 'admin@primetek.com'}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono font-semibold text-emerald-500 uppercase tracking-wider">Active Secure</span>
              </div>
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

