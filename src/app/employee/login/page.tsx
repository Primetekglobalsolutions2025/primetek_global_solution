import type { Metadata } from 'next';
import EmployeeLoginForm from '@/components/employee/EmployeeLoginForm';
import Logo from '@/components/ui/Logo';

export const metadata: Metadata = { title: 'Employee Login' };

export default function EmployeeLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-noise opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="mb-6 scale-110">
            <Logo className="w-44 h-auto" dark={true} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
            <span className="text-[10px] font-bold text-primary-200 uppercase tracking-[0.2em]">Secure Portal</span>
          </div>
          <h1 className="text-2xl font-sans font-black text-white tracking-tight">Employee Portal</h1>
          <p className="text-gray-400 text-xs mt-2 font-medium">Global workforce authentication</p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-3xl rounded-[2.5rem] p-8 md:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/10 relative overflow-hidden group">
          {/* Subtle card internal glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl group-hover:bg-primary-500/20 transition-colors duration-700" />
          
          <EmployeeLoginForm />

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} Primetek Global Solutions
            </p>
          </div>
        </div>

        {/* Support links */}
        <div className="mt-8 flex justify-center gap-6">
          <a href="mailto:it-support@primetekglobal.com?subject=Employee%20Help%20Center%20Request" className="text-[11px] font-bold text-gray-500 hover:text-primary-400 uppercase tracking-wider transition-colors">Help Center</a>
          <a href="mailto:it-support@primetekglobal.com?subject=Employee%20Portal%20Support" className="text-[11px] font-bold text-gray-500 hover:text-primary-400 uppercase tracking-wider transition-colors">IT Support</a>
        </div>
      </div>
    </div>
  );
}
