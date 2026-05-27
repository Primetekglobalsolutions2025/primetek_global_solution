import Link from 'next/link';
import { Globe, Mail, Phone, MapPin } from 'lucide-react';
import Logo from '@/components/ui/Logo';

const quickLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About Us' },
  { href: '/services', label: 'Services' },
  { href: '/industries', label: 'Industries' },
  { href: '/contact', label: 'Contact' },
];

const serviceLinks = [
  { href: '/services#it-staffing', label: 'IT Staffing' },
  { href: '/services#consulting', label: 'Consulting' },
  { href: '/services#outsourcing', label: 'Outsourcing' },
  { href: '/services#non-it', label: 'Non-IT Staffing' },
];

export default function Footer() {
  return (
    <footer className="bg-navy-900 text-text-on-dark public-footer">
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
              staffing, consulting, and outsourcing.
            </p>
            <div className="flex gap-3">
              {[
                { Icon: Globe, href: '#', label: 'LinkedIn' },
                { Icon: Globe, href: '#', label: 'Twitter' },
                { Icon: Mail, href: 'mailto:hr@primetekglobalsolutions.com', label: 'Email' },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-primary-400 hover:bg-white/10 transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
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
              {serviceLinks.map((link) => (
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

          {/* Contact Info */}
          <div>
            <h3 className="font-heading text-white font-semibold text-base mb-5">Get in Touch</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-primary-400 mt-1 shrink-0" />
                <span className="text-gray-400 text-sm">hr@primetekglobalsolutions.com</span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-primary-400 mt-1 shrink-0" />
                <span className="text-gray-400 text-sm">+1 (219) 345-6559</span>
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
            <Link href="#" className="hover:text-primary-400 transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-primary-400 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
