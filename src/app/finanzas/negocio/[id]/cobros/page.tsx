'use client';
import { useParams } from 'next/navigation';
import ObligationsView from '@/components/business/ObligationsView';

export default function BusinessCobrosPage() {
  const { id } = useParams<{ id: string }>();
  return <ObligationsView businessId={id} type="cobro" />;
}
