import type { ComplaintStatus } from '../../types/database'
import { CheckCircle2, ShieldCheck } from 'lucide-react'

const config: Record<ComplaintStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'badge-pending' },
  escalated: { label: 'Escalated', className: 'badge-escalated' },
  in_progress: { label: 'In Progress', className: 'badge-in-progress' },
  resolved: { label: 'Resolved', className: 'badge-resolved' },
  not_resolved: { label: 'Not Resolved', className: 'badge-not-resolved' },
  reopened: { label: 'Reopened', className: 'badge-reopened' },
}

interface StatusBadgeProps {
  status: ComplaintStatus
  isEscalated?: boolean
}

export default function StatusBadge({ status, isEscalated = false }: StatusBadgeProps) {
  // Differentiate directly resolved vs. escalated and resolved
  if (status === 'resolved' && isEscalated) {
    return (
      <span
        className="badge bg-purple-50 text-purple-700 border border-purple-200 font-semibold inline-flex items-center gap-1"
        title="Escalated to Field Intelligence and Resolved"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
        <ShieldCheck className="w-3 h-3 text-purple-600" />
        <span>Escalated & Resolved</span>
      </span>
    )
  }

  if (status === 'resolved') {
    return (
      <span
        className="badge badge-resolved inline-flex items-center gap-1"
        title="Direct CCE Resolution"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        <span>Resolved</span>
      </span>
    )
  }

  const { label, className } = config[status] ?? {
    label: status,
    className: 'badge bg-gray-100 text-gray-600',
  }

  return <span className={className}>{label}</span>
}
