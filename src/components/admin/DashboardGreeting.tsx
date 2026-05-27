'use client';

import { motion } from 'framer-motion';
import { Search, Sparkles } from 'lucide-react';

interface DashboardGreetingProps {
  userName?: string;
}

export default function DashboardGreeting({ userName }: DashboardGreetingProps) {
  const firstName = userName ? userName.split(' ')[0] : 'Admin';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl bg-navy-900 p-6 md:p-8 text-white shadow-md shadow-navy-900/10 mb-6 group"
    >
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[100%] bg-primary-500/20 rounded-full blur-[100px] group-hover:bg-primary-500/30 transition-colors duration-1000" />
        <div className="absolute bottom-[-20%] left-[-5%] w-[40%] h-[80%] bg-teal-500/10 rounded-full blur-[80px]" />
        <div className="absolute inset-0 bg-noise opacity-[0.05] mix-blend-overlay" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-3">
            <span className="text-[9px] font-bold text-primary-200 uppercase tracking-wider">System Status: Optimal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight text-white">
            Welcome Back,<br />
            <span className="text-primary-400 drop-shadow-md brightness-110">
              {firstName}
            </span>
          </h1>
          <p className="text-gray-300 text-xs mt-2 font-medium max-w-md opacity-90">
            Here's what's happening across the Primetek Global ecosystem today.
          </p>
        </div>

        <div className="w-full md:w-auto md:min-w-[280px]">
          <div className="relative group/search">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within/search:text-primary-400 transition-colors" />
            <input
              type="text"
              placeholder="Search anything..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 backdrop-blur-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
