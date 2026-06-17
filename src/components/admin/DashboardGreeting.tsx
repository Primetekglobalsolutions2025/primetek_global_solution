'use client';

import { motion } from 'framer-motion';
import { Settings, CheckSquare, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface DashboardGreetingProps {
  userName?: string;
  email?: string;
}

export default function DashboardGreeting({ userName }: DashboardGreetingProps) {
  const firstName = userName ? userName.split(' ')[0] : 'Admin';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[255px] rounded-[24px] bg-gradient-to-r from-navy-900 via-primary-800 to-primary-600 bg-[length:200%_200%] animate-gradient-shift relative overflow-hidden p-5 flex flex-col justify-between gap-4 shadow-sm mb-6 text-white"
    >
      {/* Background Decorative Rings */}
      <div className="absolute top-[-20%] right-[-10%] w-[160px] h-[160px] rounded-full border border-white/10 pointer-events-none" />
      <div className="absolute top-[-30%] right-[-20%] w-[210px] h-[210px] rounded-full border border-white/5 pointer-events-none" />
      
      {/* Subtle Decorative mesh highlights */}
      <div className="absolute top-[-25%] right-[-15%] w-[45%] h-[130%] bg-primary-500/15 rounded-full blur-[90px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-5%] w-[35%] h-[90%] bg-emerald-500/5 rounded-full blur-[70px] pointer-events-none" />
      
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
          <p className="text-white/60 text-[11px] mt-1.5 pb-2 leading-relaxed">
            Realtime workforce monitoring, attendance telemetry, operational approvals, and compliance oversight.
          </p>
        </div>
      </div>

      {/* Bottom Action Cards */}
      <div className="flex gap-3 relative z-10 w-full">
        {/* Review Approvals */}
        <Link href="/admin/approvals" className="flex-1">
          <div className="bg-white/15 backdrop-blur-md rounded-[20px] p-3 flex items-center justify-between border border-white/20 cursor-pointer hover:bg-white/20 active:scale-[0.98] transition-all">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-primary-400 shrink-0">
                <CheckSquare className="w-4.5 h-4.5 stroke-[2.2]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-extrabold text-white leading-tight">Review Approvals</span>
                <span className="text-[9px] text-white/70 leading-none mt-0.5 font-medium">Approve leaves & WFH</span>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-white animate-pulse" />
          </div>
        </Link>

        {/* System Settings */}
        <Link href="/admin/settings" className="flex-1">
          <div className="bg-white/15 backdrop-blur-md rounded-[20px] p-3 flex items-center justify-between border border-white/20 cursor-pointer hover:bg-white/20 active:scale-[0.98] transition-all">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-primary-400 shrink-0">
                <Settings className="w-4.5 h-4.5 stroke-[2.2]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-extrabold text-white leading-tight">System Settings</span>
                <span className="text-[9px] text-white/70 leading-none mt-0.5 font-medium">Manage portal configs</span>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-white animate-pulse" />
          </div>
        </Link>
      </div>
    </motion.div>
  );
}

