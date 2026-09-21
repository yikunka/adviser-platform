'use client'

import { useParams } from 'next/navigation'
import { JmmOrderForm } from '../JmmOrderForm'

export default function JmmOrderDetailPage() {
  const params = useParams<{ id: string }>()
  return <JmmOrderForm orderId={params.id} />
}
