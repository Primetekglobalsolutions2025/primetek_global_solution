import React, { forwardRef, InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, label, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-navy-900 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full px-4 py-3 rounded-lg border bg-white text-navy-900 placeholder:text-text-muted transition-all text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
            error
              ? 'border-error focus:ring-error/20'
              : 'border-border focus:ring-primary-400'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-error text-xs mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
