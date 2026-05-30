'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { 
  Menu, 
  X, 
  ArrowRight, 
  ChevronDown, 
  Briefcase, 
  Building2, 
  UserCheck, 
  Users, 
  Monitor, 
  HeartPulse, 
  Landmark 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Logo from '@/components/ui/Logo';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  // Mobile Accordion state
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on pathname change
  useEffect(() => {
    setIsOpen(false);
    setActiveAccordion(null);
  }, [pathname]);

  const toggleAccordion = (item: string) => {
    setActiveAccordion(activeAccordion === item ? null : item);
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-200 public-header border-b bg-white',
        isScrolled ? 'border-hairline shadow-sm' : 'border-transparent'
      )}
    >
      <div className="max-w-[1200px] mx-auto px-4 h-full flex items-center justify-between relative">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center group shrink-0">
          <Logo className="w-48 h-auto" dark={false} />
        </Link>

        {/* Center: Desktop Navigation */}
        <div className="hidden md:flex items-center h-full">
          <NavigationMenu.Root className="z-50 flex items-center h-full">
            <NavigationMenu.List className="flex items-center gap-1 list-none m-0 p-0 h-full">
              
              {/* Item: Services */}
              <NavigationMenu.Item className="h-full flex items-center">
                <NavigationMenu.Trigger className="group flex items-center gap-1 px-4 py-2 text-sm font-medium text-body-text hover:text-teal-primary transition-colors bg-transparent border-0 outline-none cursor-pointer">
                  Services
                  <ChevronDown className="w-4 h-4 text-muted group-data-[state=open]:rotate-180 transition-transform duration-200" />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className="w-[800px] flex gap-8 p-8 outline-none">
                  {/* Left panel */}
                  <div className="w-[260px] shrink-0 pr-8 border-r border-hairline flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.5px] text-teal-primary leading-tight mb-2">
                        Staffing Services
                      </h3>
                      <p className="text-sm text-muted leading-relaxed mb-6">
                        Contract, C2C, and full-time IT placement for US-based companies. Roles filled in 3-5 days.
                      </p>
                    </div>
                    <NavigationMenu.Link asChild>
                      <Link href="/services" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-teal-primary hover:bg-teal-active px-4 py-2 rounded-md transition-colors w-fit">
                        View All Services <ArrowRight className="w-4 h-4" />
                      </Link>
                    </NavigationMenu.Link>
                  </div>
                  {/* Right panel - 2x2 grid */}
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <Link href="/services#staffing" className="p-3 rounded-lg border border-hairline hover:bg-surface-card transition-all group flex gap-3">
                      <div className="w-10 h-10 rounded bg-teal-primary/5 text-teal-primary flex items-center justify-center shrink-0">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-ink mb-0.5 group-hover:text-teal-primary transition-colors">Contract Staffing</h4>
                        <p className="text-xs text-muted leading-relaxed">Short-to-mid term IT professionals for project-based work.</p>
                      </div>
                    </Link>
                    <Link href="/services#staffing" className="p-3 rounded-lg border border-hairline hover:bg-surface-card transition-all group flex gap-3">
                      <div className="w-10 h-10 rounded bg-teal-primary/5 text-teal-primary flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-ink mb-0.5 group-hover:text-teal-primary transition-colors">C2C Placements</h4>
                        <p className="text-xs text-muted leading-relaxed">Independent contractors operating through their own corporate entities.</p>
                      </div>
                    </Link>
                    <Link href="/services#staffing" className="p-3 rounded-lg border border-hairline hover:bg-surface-card transition-all group flex gap-3">
                      <div className="w-10 h-10 rounded bg-teal-primary/5 text-teal-primary flex items-center justify-center shrink-0">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-ink mb-0.5 group-hover:text-teal-primary transition-colors">Contract-to-Hire</h4>
                        <p className="text-xs text-muted leading-relaxed">Evaluate candidates on the job before committing permanently.</p>
                      </div>
                    </Link>
                    <Link href="/services#staffing" className="p-3 rounded-lg border border-hairline hover:bg-surface-card transition-all group flex gap-3">
                      <div className="w-10 h-10 rounded bg-teal-primary/5 text-teal-primary flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-ink mb-0.5 group-hover:text-teal-primary transition-colors">Full-Time Recruitment</h4>
                        <p className="text-xs text-muted leading-relaxed">End-to-end permanent IT hiring for US-based enterprises.</p>
                      </div>
                    </Link>
                  </div>
                </NavigationMenu.Content>
              </NavigationMenu.Item>

              {/* Item: Industries */}
              <NavigationMenu.Item className="h-full flex items-center">
                <NavigationMenu.Trigger className="group flex items-center gap-1 px-4 py-2 text-sm font-medium text-body-text hover:text-teal-primary transition-colors bg-transparent border-0 outline-none cursor-pointer">
                  Industries
                  <ChevronDown className="w-4 h-4 text-muted group-data-[state=open]:rotate-180 transition-transform duration-200" />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className="w-[700px] flex gap-8 p-8 outline-none">
                  {/* Left panel */}
                  <div className="w-[240px] shrink-0 pr-8 border-r border-hairline flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.5px] text-teal-primary leading-tight mb-2">
                        Industries We Serve
                      </h3>
                      <p className="text-sm text-muted leading-relaxed mb-6">
                        Active placements in IT, Healthcare, and Banking & Finance across the US.
                      </p>
                    </div>
                    <NavigationMenu.Link asChild>
                      <Link href="/industries" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-teal-primary hover:bg-teal-active px-4 py-2 rounded-md transition-colors w-fit">
                        View Industries <ArrowRight className="w-4 h-4" />
                      </Link>
                    </NavigationMenu.Link>
                  </div>
                  {/* Right panel - vertical list */}
                  <div className="flex-1 flex flex-col gap-3">
                    <Link href="/industries" className="p-2.5 rounded-lg border border-hairline hover:bg-surface-card transition-all group flex gap-3">
                      <div className="w-9 h-9 rounded bg-teal-primary/5 text-teal-primary flex items-center justify-center shrink-0">
                        <Monitor className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-ink mb-0.5 group-hover:text-teal-primary transition-colors">Information Technology</h4>
                        <p className="text-xs text-muted leading-relaxed">Full-stack developers, cloud architects, cybersecurity experts.</p>
                      </div>
                    </Link>
                    <Link href="/industries" className="p-2.5 rounded-lg border border-hairline hover:bg-surface-card transition-all group flex gap-3">
                      <div className="w-9 h-9 rounded bg-teal-primary/5 text-teal-primary flex items-center justify-center shrink-0">
                        <HeartPulse className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-ink mb-0.5 group-hover:text-teal-primary transition-colors">Healthcare</h4>
                        <p className="text-xs text-muted leading-relaxed">Health IT, clinical systems, compliance-driven recruiting.</p>
                      </div>
                    </Link>
                    <Link href="/industries" className="p-2.5 rounded-lg border border-hairline hover:bg-surface-card transition-all group flex gap-3">
                      <div className="w-9 h-9 rounded bg-teal-primary/5 text-teal-primary flex items-center justify-center shrink-0">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-ink mb-0.5 group-hover:text-teal-primary transition-colors">Banking & Finance</h4>
                        <p className="text-xs text-muted leading-relaxed">Fintech developers, risk analysts, compliance specialists.</p>
                      </div>
                    </Link>
                  </div>
                </NavigationMenu.Content>
              </NavigationMenu.Item>

              {/* Direct Link: About */}
              <NavigationMenu.Item className="h-full flex items-center">
                <NavigationMenu.Link asChild>
                  <Link href="/about" className={cn(
                    'px-4 py-2 text-sm font-medium text-body-text hover:text-teal-primary transition-colors',
                    pathname === '/about' && 'text-teal-primary font-semibold'
                  )}>
                    About
                  </Link>
                </NavigationMenu.Link>
              </NavigationMenu.Item>

              {/* Direct Link: Contact */}
              <NavigationMenu.Item className="h-full flex items-center">
                <NavigationMenu.Link asChild>
                  <Link href="/contact" className={cn(
                    'px-4 py-2 text-sm font-medium text-body-text hover:text-teal-primary transition-colors',
                    pathname === '/contact' && 'text-teal-primary font-semibold'
                  )}>
                    Contact
                  </Link>
                </NavigationMenu.Link>
              </NavigationMenu.Item>

            </NavigationMenu.List>
            
            {/* Nav Viewport anchor */}
            <div className="absolute left-0 top-full flex justify-center w-full">
              <NavigationMenu.Viewport className="relative mt-2 origin-[top_center] h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-xl border border-hairline bg-white shadow-lg md:w-[var(--radix-navigation-menu-viewport-width)] transition-[width,height] duration-200" />
            </div>
          </NavigationMenu.Root>
        </div>

        {/* Right: CTA Button */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/contact">
            <Button size="sm" className="bg-teal-primary hover:bg-teal-active text-white border-0">
              Get in Touch <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Mobile Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-ink hover:bg-surface-card transition-colors border-0 bg-transparent cursor-pointer"
          aria-expanded={isOpen}
          aria-controls="mobile-navigation-sheet"
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Full-Screen Menu Sheet */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            id="mobile-navigation-sheet"
            className="fixed inset-0 top-16 bg-white z-40 flex flex-col md:hidden border-t border-hairline overflow-y-auto"
          >
            <div className="flex-1 px-6 py-8 flex flex-col gap-4">
              {/* Accordion Item: Services */}
              <div className="border-b border-hairline pb-4">
                <button
                  onClick={() => toggleAccordion('services')}
                  className="w-full flex items-center justify-between py-2 text-lg font-semibold text-ink border-0 bg-transparent text-left cursor-pointer"
                >
                  Services
                  <ChevronDown className={cn(
                    'w-5 h-5 text-muted transition-transform duration-200',
                    activeAccordion === 'services' && 'rotate-180 text-teal-primary'
                  )} />
                </button>
                <AnimatePresence>
                  {activeAccordion === 'services' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pl-4 flex flex-col gap-3 mt-2"
                    >
                      <Link href="/services#staffing" className="text-sm font-medium text-body-text py-1.5 hover:text-teal-primary">Contract Staffing</Link>
                      <Link href="/services#staffing" className="text-sm font-medium text-body-text py-1.5 hover:text-teal-primary">C2C Placements</Link>
                      <Link href="/services#staffing" className="text-sm font-medium text-body-text py-1.5 hover:text-teal-primary">Contract-to-Hire</Link>
                      <Link href="/services#staffing" className="text-sm font-medium text-body-text py-1.5 hover:text-teal-primary">Full-Time Recruitment</Link>
                      <Link href="/services" className="text-sm font-semibold text-teal-primary py-1.5 border-t border-hairline mt-1">View All Services →</Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Accordion Item: Industries */}
              <div className="border-b border-hairline pb-4">
                <button
                  onClick={() => toggleAccordion('industries')}
                  className="w-full flex items-center justify-between py-2 text-lg font-semibold text-ink border-0 bg-transparent text-left cursor-pointer"
                >
                  Industries
                  <ChevronDown className={cn(
                    'w-5 h-5 text-muted transition-transform duration-200',
                    activeAccordion === 'industries' && 'rotate-180 text-teal-primary'
                  )} />
                </button>
                <AnimatePresence>
                  {activeAccordion === 'industries' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pl-4 flex flex-col gap-3 mt-2"
                    >
                      <Link href="/industries" className="text-sm font-medium text-body-text py-1.5 hover:text-teal-primary">Information Technology</Link>
                      <Link href="/industries" className="text-sm font-medium text-body-text py-1.5 hover:text-teal-primary">Healthcare</Link>
                      <Link href="/industries" className="text-sm font-medium text-body-text py-1.5 hover:text-teal-primary">Banking & Finance</Link>
                      <Link href="/industries" className="text-sm font-semibold text-teal-primary py-1.5 border-t border-hairline mt-1">View Industries →</Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Direct Links */}
              <Link href="/about" className="text-lg font-semibold text-ink border-b border-hairline py-3 hover:text-teal-primary">About</Link>
              <Link href="/contact" className="text-lg font-semibold text-ink border-b border-hairline py-3 hover:text-teal-primary">Contact</Link>

              {/* Mobile CTA at bottom */}
              <div className="mt-8">
                <Link href="/contact">
                  <Button size="lg" className="w-full bg-teal-primary hover:bg-teal-active text-white border-0">
                    Get in Touch <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
