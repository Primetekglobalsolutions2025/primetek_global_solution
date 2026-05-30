'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const steps = [
  {
    num: '01',
    title: 'Submit Your Requirement',
    desc: 'Tell us the role, tech stack, location, and timeline via our contact form.'
  },
  {
    num: '02',
    title: 'We Source and Screen',
    desc: 'We identify and pre-screen candidates from our network. Contract roles: 3-5 days. Full-time: 7-10 days.'
  },
  {
    num: '03',
    title: 'You Interview and Hire',
    desc: 'Review shortlisted profiles, conduct interviews, and make the hire. We handle the paperwork.'
  }
];

export default function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="py-24 bg-surface-card border-y border-hairline">
      <div className="max-w-[1200px] mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <span className="text-sm font-semibold tracking-wider text-teal-primary uppercase block mb-3">
            THE PROCESS
          </span>
          <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-[-1.5px] leading-[1.1] mb-4">
            From Requirement to Hire in Days
          </h2>
        </div>

        {/* Steps container */}
        <div ref={ref} className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          
          {/* Connector Line behind numbers on desktop */}
          <div className="hidden md:block absolute top-[52px] left-[10%] right-[10%] h-[2px] bg-hairline z-0" />

          {steps.map((step, index) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="relative z-10 flex flex-col h-full bg-white rounded-xl border border-hairline p-6 shadow-sm hover:border-teal-primary/30 transition-colors"
            >
              {/* Number and Dot Badge */}
              <div className="flex items-center gap-3 mb-6 relative">
                <div className="text-4xl font-semibold text-teal-primary tracking-tight z-10 bg-white pr-2">
                  {step.num}
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-teal-primary shrink-0 relative z-10" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-ink mb-2">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-body-text leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}

        </div>
      </div>
    </section>
  );
}
