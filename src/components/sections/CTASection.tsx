'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function CTASection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="bg-surface-card rounded-[12px] p-12 border border-hairline max-w-[640px] mx-auto text-center shadow-sm hover:border-teal-primary/30 transition-colors">
          <h2 className="text-2xl md:text-3xl font-semibold text-ink tracking-[-0.5px] leading-tight mb-4">
            Have a Role to Fill?
          </h2>
          <p className="text-sm text-body-text leading-relaxed mb-8">
            Submit your requirement and we&apos;ll respond within 24 hours with matched candidates.
          </p>
          <Link href="/contact" className="inline-block">
            <Button
              size="lg"
              className="bg-teal-primary hover:bg-teal-active text-white border-0 px-6"
            >
              Submit a Requirement <ArrowRight className="w-4.5 h-4.5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
