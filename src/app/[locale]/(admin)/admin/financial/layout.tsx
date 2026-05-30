import { FinancialCompanyProvider } from '@/components/admin/financial/FinancialCompanyContext'

export default function FinancialLayout({ children }: { children: React.ReactNode }) {
  return <FinancialCompanyProvider>{children}</FinancialCompanyProvider>
}
