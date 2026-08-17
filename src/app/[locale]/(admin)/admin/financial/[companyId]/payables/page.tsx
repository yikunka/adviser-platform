import { redirect } from 'next/navigation'

export default async function AdminFinancialPayablesPage({
  params,
}: {
  params: Promise<{ locale: string; companyId: string }>
}) {
  const { locale, companyId } = await params
  redirect(`/${locale}/admin/financial/${companyId}`)
}
