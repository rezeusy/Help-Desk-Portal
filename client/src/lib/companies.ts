export const COMPANIES = ['Globalstar', 'Globalynx'] as const;

export type Company = (typeof COMPANIES)[number];
export type CompanyFilter = 'all' | Company | 'unassigned';

export function companyDisplayName(company: Company | string | null | undefined) {
  return company ?? 'Needs assignment';
}
