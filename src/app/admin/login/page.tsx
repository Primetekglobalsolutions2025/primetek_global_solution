import type { Metadata } from 'next';
import LoginForm from '@/components/admin/LoginForm';
import Logo from '@/components/ui/Logo';

export const metadata: Metadata = { title: 'Admin Login | Primetek Global' };

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="mb-6 scale-110">
            <Logo className="w-44 h-auto" dark={false} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50/50 border border-primary-500/20 backdrop-blur-md mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
            <span className="text-[10px] font-bold text-primary-700 uppercase tracking-[0.2em]">Secure Access</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Admin Control Center</h1>
          <p className="text-zinc-500 text-xs mt-2 font-medium">Enterprise portal authentication</p>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-zinc-200 relative overflow-hidden group">
          {/* Subtle card internal glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl group-hover:bg-primary-500/10 transition-colors duration-700" />
          
          <LoginForm />

          <div className="mt-8 pt-8 border-t border-zinc-100 text-center">
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} Primetek Global Solutions
            </p>
          </div>
        </div>

        {/* Support links */}
        <div className="mt-8 flex justify-center gap-6">
          <a href="mailto:it-support@primetekglobal.com?subject=Admin%20Password%20Reset%20Request" className="text-[11px] font-bold text-zinc-500 hover:text-primary-600 uppercase tracking-wider transition-colors">Forgot Password?</a>
          <a href="mailto:it-support@primetekglobal.com?subject=Admin%20Portal%20Support" className="text-[11px] font-bold text-zinc-500 hover:text-primary-600 uppercase tracking-wider transition-colors">Support</a>
        </div>
      </div>
    </div>
  );
}
