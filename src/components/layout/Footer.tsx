import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';
import Logo from '@/components/ui/Logo';

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="bg-surface-dark text-text-on-dark public-footer" itemScope itemType="https://schema.org/WPFooter">
      <div className="max-w-[1200px] mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          
          {/* Col 1 - Brand */}
          <div>
            <Link href="/" className="inline-block mb-4">
              <Logo className="w-48 h-auto" dark={true} />
            </Link>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              US-Based IT Staffing.<br />
              Contract, C2C, Full-Time.
            </p>
            <div className="flex gap-3">
              <a
                href="https://www.linkedin.com/company/primetek-global-solutions-llc"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on LinkedIn"
                className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 hover:text-[#0A66C2] hover:bg-white/10 transition-all"
              >
                <LinkedInIcon className="w-4 h-4" />
              </a>
              <a
                href="mailto:hr@primetekglobalsolutions.com"
                aria-label="Send us an email"
                className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 hover:text-teal-accent hover:bg-white/10 transition-all"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Col 2 - Company */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-5">Company</h3>
            <ul className="space-y-3 list-none p-0 m-0">
              <li>
                <Link href="/about" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/industries" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Industries
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3 - Services */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-5">Services</h3>
            <ul className="space-y-3 list-none p-0 m-0">
              <li>
                <Link href="/services#staffing" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Contract Staffing
                </Link>
              </li>
              <li>
                <Link href="/services#staffing" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  C2C Placements
                </Link>
              </li>
              <li>
                <Link href="/services#staffing" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Contract-to-Hire
                </Link>
              </li>
              <li>
                <Link href="/services#staffing" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Full-Time Recruitment
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4 - Contact */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-5">Contact</h3>
            <ul className="space-y-4 list-none p-0 m-0">
              <li>
                <a href="mailto:hr@primetekglobalsolutions.com" className="flex items-start gap-3 group">
                  <Mail className="w-4 h-4 text-teal-accent mt-1 shrink-0" />
                  <span className="text-zinc-400 group-hover:text-white text-sm transition-colors break-all">
                    hr@primetekglobalsolutions.com
                  </span>
                </a>
              </li>
              <li>
                <a href="tel:+12193456559" className="flex items-start gap-3 group">
                  <Phone className="w-4 h-4 text-teal-accent mt-1 shrink-0" />
                  <span className="text-zinc-400 group-hover:text-white text-sm transition-colors">
                    +1 (219) 345-6559
                  </span>
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-teal-accent mt-1 shrink-0" />
                <span className="text-zinc-400 text-sm">
                  1680, Unit 2G, 14th Ave S<br />
                  Birmingham, AL 35205, USA
                </span>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/5 py-6">
        <div className="max-w-[1200px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 text-sm">
            © 2024 Primetek Global Solutions. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy" className="text-zinc-500 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-zinc-500 hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
