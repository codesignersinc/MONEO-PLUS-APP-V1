'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import BusinessEntrySheet from '@/components/business/BusinessEntrySheet';

// Every page of a business: the mobile "+" (MobileNav) registers a business movement.
export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('moneo:negocio-nuevo', show);
    return () => window.removeEventListener('moneo:negocio-nuevo', show);
  }, []);
  return (
    <>
      {children}
      {open && (
        <BusinessEntrySheet
          businessId={id}
          mode="gasto"
          onClose={() => setOpen(false)}
          onSaved={() => setOpen(false)}
        />
      )}
    </>
  );
}
