/**
 * Centralized Design System Tokens for Primetek Global Solutions
 * Targets compact, high-density, premium SaaS aesthetics (inspired by Vercel, Linear, Stripe).
 */

export const typography = {
  // Page Title scale
  pageTitle: "text-xl md:text-2xl font-bold tracking-tight text-navy-900",
  pageTitleLight: "text-2xl md:text-3xl font-extrabold tracking-tight text-white",

  // Desktop scales
  sectionTitle: "text-lg font-semibold text-navy-900",
  cardTitle: "text-base font-semibold text-navy-900",
  body: "text-sm text-text-secondary leading-relaxed",
  bodyMuted: "text-xs text-text-muted leading-relaxed",
  label: "text-xs font-semibold text-navy-900",
  tableHeader: "text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500",
  tableCell: "text-sm text-navy-900 font-medium",
  sidebarNav: "text-sm font-medium",
  badge: "text-[11px] font-semibold tracking-wider uppercase",
  
  // Mobile scales
  mobilePageTitle: "text-xl font-semibold tracking-tight text-navy-900",
  mobileSectionTitle: "text-base font-semibold text-navy-900",
  mobileCardTitle: "text-sm font-semibold text-navy-900",
};

export const spacing = {
  sectionGap: "space-y-6",
  gridGap: "gap-4",
  gridGapLarge: "gap-6",
  cardPadding: "p-4 md:p-5",
  formGap: "space-y-4",
  formGridGap: "gap-4",
};

export const radius = {
  card: "rounded-xl",
  button: "rounded-lg",
  input: "rounded-lg",
  badge: "rounded-full",
  avatar: "rounded-lg",
};

export const shadow = {
  sm: "shadow-sm",
  md: "shadow-md border border-border/80",
  premium: "shadow-sm border border-border/60 hover:shadow-md hover:border-primary-300/30 transition-all duration-200",
};

export const layout = {
  adminMaxWidth: "max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8",
  employeeMaxWidth: "max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8",
  sidebarWidth: "w-64",
  sidebarCollapsedWidth: "w-16",
};

export const table = {
  rowHeight: "h-11",
  cellPadding: "px-5 py-3",
  headerPadding: "px-5 py-3.5",
};

export const zIndex = {
  sidebar: "z-30",
  header: "z-20",
  modal: "z-50",
  drawer: "z-[101]",
  overlay: "z-[100]",
};

export const transition = {
  fast: "transition-all duration-150 ease-in-out",
  default: "transition-all duration-200 ease-in-out",
};
