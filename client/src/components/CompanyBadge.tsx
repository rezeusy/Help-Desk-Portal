import { cn } from '@/lib/utils';
import { companyDisplayName, type Company } from '@/lib/companies';

interface CompanyBadgeProps {
  company?: Company | string | null;
  compact?: boolean;
}

export function CompanyBadge({ company, compact = false }: CompanyBadgeProps) {
  const label = companyDisplayName(company);
  const isGlobalstar = company === 'Globalstar';
  const isGlobalynx = company === 'Globalynx';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
        compact && 'px-1.5 py-0.5 text-[9px]',
        isGlobalstar && 'border-[#b9d6ff] bg-[#edf5ff] text-[#2761a8] dark:border-[#365d8f] dark:bg-[#193052] dark:text-[#b9d6ff]',
        isGlobalynx && 'border-[#cfc4ff] bg-[#f2efff] text-[#654fc1] dark:border-[#6759a6] dark:bg-[#302952] dark:text-[#d9d1ff]',
        !company && 'border-[#f1d19a] bg-[#fff8e8] text-[#a46b0a] dark:border-[#7c5a24] dark:bg-[#3a2c16] dark:text-[#f6d28e]',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', isGlobalstar && 'bg-[#4f94ed]', isGlobalynx && 'bg-[#8b76ed]', !company && 'bg-[#d99a2b]')} />
      {compact ? (company === 'Globalstar' ? 'GS' : company === 'Globalynx' ? 'GX' : 'Assign') : label}
    </span>
  );
}
