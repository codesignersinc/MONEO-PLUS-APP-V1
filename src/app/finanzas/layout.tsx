'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/finance/Sidebar';
import MobileNav from '@/components/finance/MobileNav';
import AddTransactionModal from '@/components/finance/AddTransactionModal';
import { useAuth } from '@/contexts/AuthContext';

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[#FAFAF8] font-poppins">
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)} />
      <MobileNav onFabClick={() => setShowModal(true)} />
      <main
        className={`pb-24 lg:pb-0 min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-60'}`}
      >
        {(!loading && user) ? children : (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-gray-500">Cargando...</p>
            </div>
          </div>
        )}
      </main>
      <AddTransactionModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
