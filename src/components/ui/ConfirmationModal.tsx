'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, HelpCircle } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import { cn } from '@/lib/utils';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
}: ConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(modalRef, isOpen, onClose);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-navy-900/60 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer text-navy-900"
        >
          <motion.div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="w-full max-w-sm cursor-default"
          >
            <Card hover={false} className="p-5 rounded-xl border border-border shadow-2xl bg-white relative overflow-hidden">
              <div className="flex flex-col items-center text-center space-y-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-lg flex items-center justify-center',
                    variant === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-primary-500/10 text-primary-500'
                  )}
                >
                  {variant === 'danger' ? (
                    <AlertCircle className="w-6 h-6" />
                  ) : (
                    <HelpCircle className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-900 tracking-tight">{title}</h3>
                  <p className="text-xs text-text-muted mt-1.5 font-medium leading-relaxed">{message}</p>
                </div>
                <div className="flex w-full gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 px-3 rounded-lg bg-surface-alt hover:bg-border/60 text-navy-900 text-xs font-semibold transition-all cursor-pointer border border-border"
                  >
                    {cancelLabel}
                  </button>
                  <Button
                    onClick={() => {
                      onConfirm();
                      onClose();
                    }}
                    disabled={isLoading}
                    size="sm"
                    className={cn(
                      'flex-1 border',
                      variant === 'danger'
                        ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white'
                        : 'bg-navy-900 hover:bg-navy-800 border-navy-950 text-white'
                    )}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
