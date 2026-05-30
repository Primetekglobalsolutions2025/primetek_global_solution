'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SectionHeading from '@/components/ui/SectionHeading';
import { faqs } from '@/lib/faq-data';

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="section-padding bg-surface-alt" id="faq">
      <div className="container-wide">
        <SectionHeading
          label="Frequently Asked Questions"
          title="Got Questions? We've Got Answers"
        />
        <div className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="border-b border-border last:border-b-0"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between py-5 text-left group"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                  id={`faq-question-${index}`}
                >
                  <span className="text-navy-900 font-semibold text-base pr-4 group-hover:text-primary-500 transition-colors">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-text-muted shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-primary-500' : ''
                    }`}
                  />
                </button>
                <div
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-question-${index}`}
                  className={`overflow-hidden transition-all duration-300 ${
                    isOpen ? 'max-h-96 pb-5' : 'max-h-0'
                  }`}
                >
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
