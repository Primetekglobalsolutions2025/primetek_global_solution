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
      className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-navy-900 to-primary-600 p-6 md:p-8 text-white shadow-sm mb-6 flex flex-col justify-between"
    >
      {/* Background Decorative Rings */}
      <div className="absolute top-[-20%] right-[-10%] w-[160px] h-[160px] rounded-full border border-white/10 pointer-events-none" />
      <div className="absolute top-[-30%] right-[-20%] w-[210px] h-[210px] rounded-full border border-white/5 pointer-events-none" />
      
      {/* Subtle Decorative mesh highlights */}
      <div className="absolute top-[-25%] right-[-15%] w-[45%] h-[130%] bg-primary-500/15 rounded-full blur-[90px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-5%] w-[35%] h-[90%] bg-emerald-500/5 rounded-full blur-[70px] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/10 border border-white/15 shadow-inner font-mono text-[9px] font-semibold uppercase tracking-wider text-primary-200 backdrop-blur-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Operations Center</span>
          </div>
          
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Welcome Back,<br />
              <span className="text-primary-300 brightness-110 flex items-center gap-1.5 mt-0.5">{firstName} <span className="animate-bounce">👋</span></span>
            </h1>
            <p className="text-white/70 text-xs mt-2.5 max-w-md font-medium leading-relaxed font-sans pb-2">
              Realtime workforce monitoring, attendance telemetry, operational approvals, and compliance oversight.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/admin/approvals">
              <Button className="bg-white text-navy-900 hover:bg-zinc-100 rounded-lg px-4.5 py-2.5 text-xs font-bold shadow-sm transition-all active:scale-[0.98] font-sans flex items-center group">
                <CheckSquare className="w-3.5 h-3.5 mr-2 group-hover:rotate-12 transition-transform text-navy-900" /> 
                Review Approvals
              </Button>
            </Link>
            <Link href="/admin/settings">
              <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/15 hover:border-white/30 rounded-lg px-4.5 py-2.5 text-xs font-bold transition-all active:scale-[0.98] font-sans flex items-center backdrop-blur-xs">
                System Settings <Settings className="w-3.5 h-3.5 ml-2 text-white" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Profile Card */}
        <div className="relative">
          <div className="bg-navy-950/45 rounded-xl p-5 border border-white/10 w-full lg:w-[280px] shadow-sm backdrop-blur-xs">
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

