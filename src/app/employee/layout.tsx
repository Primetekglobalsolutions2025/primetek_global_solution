import type { Metadata } from 'next';
import EmployeeLayoutClient from './EmployeeLayoutClient';

export const metadata: Metadata = {
  title: 'Employee Portal | Primetek Global Solutions',
  manifest: '/manifest-employee.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Primetek Employee',
  },
};

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <EmployeeLayoutClient>{children}</EmployeeLayoutClient>;
}
