import InquiryTable from '@/components/admin/InquiryTable';
import { getAdminInquiries, updateInquiryStatus, deleteInquiry } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminAppInquiriesPage() {
  const inquiries = await getAdminInquiries();

  // Map database fields to component expectations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedInquiries = (inquiries || []).map((inq: any) => ({
    id: inq.id,
    name: inq.name,
    email: inq.email,
    company: inq.company || '',
    phone: inq.phone || '',
    requirement: inq.message,
    status: inq.status,
    created_at: inq.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">Inquiries</h1>
        <p className="text-text-secondary text-sm">Manage business and career inquiries.</p>
      </div>
      <InquiryTable 
        inquiries={formattedInquiries} 
        updateStatus={updateInquiryStatus} 
        deleteInquiry={deleteInquiry}
      />
    </div>
  );
}
