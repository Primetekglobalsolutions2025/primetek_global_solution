import type { Metadata } from 'next';
import AdminLayoutClient from './AdminLayoutClient';
import { getPendingCountOnly } from '@/app/admin/approvals/actions';

export const metadata: Metadata = {
  title: 'Admin Portal | Primetek Global Solutions',
  manifest: '/manifest-admin.json',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pendingCount = await getPendingCountOnly().catch(() => 0);
  return <AdminLayoutClient initialPendingCount={pendingCount}>{children}</AdminLayoutClient>;
}
