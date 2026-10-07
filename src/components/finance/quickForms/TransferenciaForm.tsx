'use client';
import TransferForm from '@/components/finance/TransferForm';
import { FormWrapper, type QuickFormProps } from '@/components/finance/quickForms/shared';

export default function TransferenciaForm({ onClose, onSuccess }: QuickFormProps) {
  return (
    <FormWrapper title="Nueva Transferencia" emoji="⇄" accentBg="bg-[#fe9a82]" onClose={onClose}>
      <TransferForm
        onSaved={onSuccess}
        saveClassName="bg-[#F97316] text-white border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)]"
      />
    </FormWrapper>
  );
}
