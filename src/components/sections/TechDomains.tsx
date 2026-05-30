'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const domains = [
  'Software Development',
  'Data Science & AI/ML',
  'Cloud & DevOps',
  'Cybersecurity',
  'QA & Test Automation',
  'ERP Technologies',
  'Business Analysis',
  'Project Management'
];

export default function TechDomains() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1200px] mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <span className="text-sm font-semibold tracking-wider text-teal-primary uppercase block mb-3">
            TECHNOLOGY DOMAINS
          </span>
          <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-[-1.5px] leading-[1.1] mb-4">
            The Roles We Fill
          </h2>
          <p className="text-base text-body-text leading-relaxed">
            We specialize in placing IT professionals across these technology domains.
          </p>
        </div>

        {/* Tag Cloud */}
        <div ref={ref} className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto mb-20">
          {domains.map((domain, index) => (
            <motion.span
              key={domain}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="px-6 py-2.5 rounded-full bg-teal-primary text-white text-sm font-semibold shadow-sm hover:bg-teal-active transition-colors cursor-default"
            >
              {domain}
            </motion.span>
          ))}
        </div>

        {/* 3-Column Stats Row */}
        <div className="border-t border-hairline pt-12 max-w-3xl mx-auto">
          <div className="grid grid-cols-3 gap-4 text-center divide-x divide-hairline">
            <div>
              <p className="text-[20px] font-semibold text-ink leading-tight mb-1">Founded</p>
              <p className="text-sm text-muted">2024</p>
            </div>
            <div>
              <p className="text-[20px] font-semibold text-ink leading-tight mb-1">Birmingham, AL</p>
              <p className="text-sm text-muted">Headquarters</p>
            </div>
            <div>
              <p className="text-[20px] font-semibold text-ink leading-tight mb-1">US Clients Only</p>
              <p className="text-sm text-muted">Domestic Placements</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
