'use client';

import { motion } from 'framer-motion';
import Card from '../ui/Card';
import { TrendingUp, Users, Calendar, Briefcase } from 'lucide-react';

interface DataPoint {
  label: string;
  value: number;
}

interface AnalyticsChartsProps {
  attendanceData: DataPoint[];
  applicationData: DataPoint[];
}

export default function AnalyticsCharts({ attendanceData, applicationData }: AnalyticsChartsProps) {
  const maxAttendance = Math.max(...attendanceData.map(d => d.value), 1);
  const maxApplications = Math.max(...applicationData.map(d => d.value), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Attendance Trends */}
      <Card hover={false} className="p-5 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] -mr-6 -mt-6 pointer-events-none">
          <Calendar className="w-24 h-24 text-navy-900" />
        </div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-navy-900 text-sm tracking-tight">Attendance Consistency</h3>
              <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Average daily check-in percentage</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
 
          <div className="relative mt-6">
            {/* Horizontal Gridlines */}
            <div className="absolute inset-x-0 top-0 h-32 flex flex-col justify-between pointer-events-none z-0">
              <div className="w-full border-t border-dashed border-zinc-200/70" />
              <div className="w-full border-t border-dashed border-zinc-200/70" />
              <div className="w-full border-t border-dashed border-zinc-200/70" />
              <div className="w-full border-t border-dashed border-zinc-200/70" />
            </div>

            <div className="relative z-10 flex items-end justify-between h-40 gap-2 px-1">
              {attendanceData.map((point, i) => (
                <div key={point.label} className="flex-1 flex flex-col items-center group">
                  <div className="relative w-full h-32 flex flex-col justify-end items-center">
                    {/* Background Track */}
                    <div className="absolute bottom-0 w-full max-w-[18px] h-full rounded-t bg-zinc-100/80" />
                    
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${(point.value / maxAttendance) * 100}%` }}
                      transition={{ duration: 1, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                      className="w-full max-w-[18px] rounded-t bg-gradient-to-t from-primary-600 to-primary-400 relative overflow-hidden group-hover:from-primary-500 group-hover:to-primary-300 transition-all duration-300 z-10"
                    >
                      <div className="absolute top-0 inset-x-0 h-px bg-white/25" />
                    </motion.div>
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-navy-900 text-white text-[9px] px-1.5 py-0.5 rounded font-bold border border-navy-950 whitespace-nowrap pointer-events-none z-20 shadow-sm">
                      {point.value}%
                    </div>
                  </div>
                  <span className="text-[9px] font-semibold text-zinc-500 mt-2 uppercase tracking-wider truncate w-full text-center">
                    {point.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
 
      {/* Recruitment Velocity */}
      <Card hover={false} className="p-5 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] -mr-6 -mt-6 pointer-events-none">
          <Briefcase className="w-24 h-24 text-navy-900" />
        </div>
 
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-navy-900 text-sm tracking-tight">Recruitment Velocity</h3>
              <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Applications received per week</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
 
          <div className="relative mt-6">
            {/* Horizontal Gridlines */}
            <div className="absolute inset-x-0 top-0 h-32 flex flex-col justify-between pointer-events-none z-0">
              <div className="w-full border-t border-dashed border-zinc-200/70" />
              <div className="w-full border-t border-dashed border-zinc-200/70" />
              <div className="w-full border-t border-dashed border-zinc-200/70" />
              <div className="w-full border-t border-dashed border-zinc-200/70" />
            </div>

            <div className="relative z-10 flex items-end justify-between h-40 gap-2 px-1">
              {applicationData.map((point, i) => (
                <div key={point.label} className="flex-1 flex flex-col items-center group">
                  <div className="relative w-full h-32 flex flex-col justify-end items-center">
                    {/* Background Track */}
                    <div className="absolute bottom-0 w-full max-w-[18px] h-full rounded-t bg-zinc-100/80" />
                    
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${(point.value / maxApplications) * 100}%` }}
                      transition={{ duration: 1, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                      className="w-full max-w-[18px] rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400 relative overflow-hidden group-hover:from-emerald-500 group-hover:to-emerald-300 transition-all duration-300 z-10"
                    >
                      <div className="absolute top-0 inset-x-0 h-px bg-white/25" />
                    </motion.div>
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-navy-900 text-white text-[9px] px-1.5 py-0.5 rounded font-bold border border-navy-950 whitespace-nowrap pointer-events-none z-20 shadow-sm">
                      {point.value}
                    </div>
                  </div>
                  <span className="text-[9px] font-semibold text-zinc-500 mt-2 uppercase tracking-wider truncate w-full text-center">
                    {point.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
