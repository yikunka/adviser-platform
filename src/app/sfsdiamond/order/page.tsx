import OrderWizard from '@/app/sfsdiamond/components/OrderWizard'
import { getSfsOrderSpecOptions } from '@/lib/sfs/diamond-spec-options-server'

export default async function SFSOrderPage() {
  const specOptions = await getSfsOrderSpecOptions()
  return <OrderWizard mode="create" specOptions={specOptions} />
}
