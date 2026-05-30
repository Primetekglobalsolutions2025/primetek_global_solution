import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';
import Logo from '@/components/ui/Logo';

const quickLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About Us' },
  { href: '/services', label: 'Services' },
  { href: '/industries', label: 'Industries' },
  { href: '/contact', label: 'Contact' },
];

const serviceLinks = [
  { href: '/services#staffing', label: 'Contract Staffing' },
  { href: '/services#staffing', label: 'C2C Placements' },
  { href: '/services#staffing', label: 'Contract-to-Hire' },
  { href: '/services#staffing', label: 'Full-Time Recruitment' },
  { href: '/services#domains', label: 'Technology Domains' },
];

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="bg-navy-900 text-text-on-dark public-footer" itemScope itemType="https://schema.org/WPFooter">
      {/* Main Footer */}
      <div className="container-wide py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center mb-4">
              <Logo className="w-48 h-auto" dark={true} />
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Empowering businesses with world-class talent solutions. Your trusted partner for
              IT staffing, consulting, and talent acquisition across the United States.
            </p>
            <div className="flex gap-3">
              <a
                href="https://www.linkedin.com/company/primetek-global-solutions-llc"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on LinkedIn"
                className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-[#0A66C2] hover:bg-white/10 transition-all duration-200"
              >
                <LinkedInIcon className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com/PrimetekGlobal"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on X (Twitter)"
                className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <TwitterIcon className="w-4 h-4" />
              </a>
              <a
                href="mailto:hr@primetekglobalsolutions.com"
                aria-label="Send us an email"
                className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-primary-400 hover:bg-white/10 transition-all duration-200"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading text-white font-semibold text-base mb-5">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 text-sm hover:text-primary-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-heading text-white font-semibold text-base mb-5">Services</h3>
            <ul className="space-y-3">
              {serviceLinks.map((link, i) => (
                <li key={`${link.href}-${i}`}>
                  <Link
                    href={link.href}
                    className="text-gray-400 text-sm hover:text-primary-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-heading text-white font-semibold text-base mb-5">Get in Touch</h3>
            <ul className="space-y-4">
              <li>
                <a href="mailto:hr@primetekglobalsolutions.com" className="flex items-start gap-3 group">
                  <Mail className="w-4 h-4 text-primary-400 mt-1 shrink-0" />
                  <span className="text-gray-400 text-sm group-hover:text-primary-400 transition-colors">hr@primetekglobalsolutions.com</span>
                </a>
              </li>
              <li>
                <a href="tel:+12193456559" className="flex items-start gap-3 group">
                  <Phone className="w-4 h-4 text-primary-400 mt-1 shrink-0" />
                  <span className="text-gray-400 text-sm group-hover:text-primary-400 transition-colors">+1 (219) 345-6559</span>
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-primary-400 mt-1 shrink-0" />
                <span className="text-gray-400 text-sm">
                  1680, Unit 2G, 14th Ave S<br />
                  Birmingham, AL 35205, USA
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container-wide py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Primetek Global Solutions. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-gray-400">
            <Link href="/sitemap.xml" className="hover:text-primary-400 transition-colors">Sitemap</Link>
            <Link href="#" className="hover:text-primary-400 transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-primary-400 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
