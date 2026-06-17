'use client';

import { useRef } from 'react';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';
import { Users, Award, Globe2, TrendingUp } from 'lucide-react';

interface StatItemProps {
  icon: React.ReactNode;
  value: number;
  suffix: string;
  label: string;
  delay: number;
}

function StatItem({ icon, value, suffix, label, delay }: StatItemProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    if (isInView) {
      animate(count, value, { duration: 2, delay, ease: 'easeOut' });
    }
  }, [isInView, count, value, delay]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className="text-center group"
    >
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary-500/10 text-primary-500 mb-4 group-hover:bg-primary-500 group-hover:text-white transition-all duration-300">
        {icon}
      </div>
      <div className="flex items-baseline justify-center gap-0.5" aria-label={`${value}${suffix} ${label}`}>
        <motion.span aria-hidden="true" className="text-4xl md:text-5xl font-bold text-navy-900">
          {rounded}
        </motion.span>
        <span aria-hidden="true" className="text-2xl md:text-3xl font-bold text-gold-500">{suffix}</span>
      </div>
      <h3 className="text-text-secondary mt-2 text-sm font-medium">{label}</h3>
    </motion.div>
  );
}

const stats = [
  { icon: <Users className="w-6 h-6" />, value: 500, suffix: '+', label: 'Clients Served' },
  { icon: <Award className="w-6 h-6" />, value: 10000, suffix: '+', label: 'Placements Made' },
  { icon: <Globe2 className="w-6 h-6" />, value: 15, suffix: '+', label: 'Industries Covered' },
  { icon: <TrendingUp className="w-6 h-6" />, value: 98, suffix: '%', label: 'Client Satisfaction' },
];

export default function Stats() {
  return (
    <section className="section-padding bg-surface-alt relative">
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/5 to-transparent" />
      <div className="container-wide relative">
        <h2 className="sr-only">Our Impact and Statistics</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <StatItem key={stat.label} {...stat} delay={index * 0.15} />
          ))}
        </div>
      </div>
    </section>
  );
}
