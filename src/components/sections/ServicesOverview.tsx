'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { Briefcase, Building2, UserCheck, Users, ArrowRight } from 'lucide-react';

const services = [
  {
    icon: <Briefcase className="w-6 h-6" />,
    title: 'Contract Staffing',
    description: 'Short-to-mid term IT professionals for project-based work. Typical duration: 3-12 months.',
    href: '/services#staffing'
  },
  {
    icon: <Building2 className="w-6 h-6" />,
    title: 'C2C (Corp-to-Corp)',
    description: 'Independent contractors through their own corporate entity. Ideal for specialized, project-based engagements.',
    href: '/services#staffing'
  },
  {
    icon: <UserCheck className="w-6 h-6" />,
    title: 'Contract-to-Hire',
    description: 'Evaluate candidates on the job before committing to permanent placement. Reduces hiring risk.',
    href: '/services#staffing'
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Full-Time Recruitment',
    description: 'End-to-end permanent IT hiring. We handle sourcing, screening, and shortlisting.',
    href: '/services#staffing'
  }
];

export default function ServicesOverview() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1200px] mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <span className="text-sm font-semibold tracking-wider text-teal-primary uppercase block mb-3">
            WHAT WE DO
          </span>
          <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-[-1.5px] leading-[1.1] mb-4">
            Four Ways We Place IT Talent
          </h2>
          <p className="text-base text-body-text leading-relaxed">
            Contract, C2C, Contract-to-Hire, and Full-Time recruitment for US-based IT roles.
          </p>
        </div>

        {/* 2x2 Grid */}
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="bg-surface-card rounded-[12px] p-8 border border-hairline flex flex-col justify-between h-full group hover:border-teal-primary/30 transition-colors">
                <div>
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-lg bg-teal-primary/5 text-teal-primary flex items-center justify-center mb-6">
                    {service.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-ink tracking-tight mb-3">
                    {service.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-body-text leading-relaxed mb-6">
                    {service.description}
                  </p>
                </div>

                {/* Link */}
                <Link
                  href={service.href}
                  className="inline-flex items-center gap-1.5 text-teal-primary hover:text-teal-active font-semibold text-sm transition-colors group-hover:gap-2.5 duration-200 w-fit"
                >
                  Learn more <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
