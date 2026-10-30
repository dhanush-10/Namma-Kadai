'use client';
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { CustomerForm } from '@/components/CustomerForm';
import { ErrorBox, Skeleton } from '@/components/ui';
import { useAsync } from '@/lib/hooks/useAsync';
import { useErrText } from '@/lib/hooks/useErrText';
import { fetchCustomer } from '@/lib/data';

export default function EditCustomer() {
  const { id } = useParams<{ id: string }>(); const errText = useErrText();
  const { data, error, reload } = useAsync(() => fetchCustomer(id), [id]);
  if (error) return <ErrorBox message={errText(error)} onRetry={reload} />;
  if (!data) return <Skeleton className="h-96" />;
  return <Suspense><CustomerForm existing={data.customer} /></Suspense>;
}
