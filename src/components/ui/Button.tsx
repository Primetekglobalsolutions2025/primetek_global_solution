'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
          fullWidth && 'w-full',
          {
            'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-400 shadow-sm active:scale-[0.98]':
              variant === 'primary',
            'bg-navy-800 text-white hover:bg-navy-700 focus:ring-navy-600 shadow-sm':
              variant === 'secondary',
            'border border-primary-500 text-primary-500 hover:bg-primary-50 focus:ring-primary-400 active:scale-[0.98]':
              variant === 'outline',
            'text-primary-600 hover:bg-primary-50 hover:text-primary-700':
              variant === 'ghost',
          },
          {
            'px-3 py-1.5 text-xs rounded-md min-h-[32px]': size === 'sm',
            'px-4 py-2 text-sm rounded-md min-h-[38px] md:min-h-[40px]': size === 'md',
            'px-5 py-2.5 text-sm rounded-md min-h-[44px]': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
