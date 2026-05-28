import type { Metadata } from 'next';
import AdminLayoutClient from './AdminLayoutClient';
import { getPendingCountOnly } from '@/app/admin/approvals/actions';

export const metadata: Metadata = {
  title: 'Admin Portal | Primetek Global Solutions',
  manifest: '/manifest-admin.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Primetek Admin',
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pendingCountPromise = getPendingCountOnly().catch(() => 0);
  return <AdminLayoutClient pendingCountPromise={pendingCountPromise}>{children}</AdminLayoutClient>;
}
