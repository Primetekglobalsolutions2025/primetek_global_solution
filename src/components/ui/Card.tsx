import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glass?: boolean;
}

export default function Card({ children, className, hover = true, glass = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-5 md:p-6 shadow-sm border border-border',
        glass
          ? 'bg-white/60 backdrop-blur-xl border-white/20'
          : 'bg-white',
        hover &&
          'transition-all duration-200 hover:shadow-md hover:border-primary-300/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
