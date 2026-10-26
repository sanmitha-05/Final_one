import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { updateLocalComplaint, appendLocalHistory, saveLocalEscalation } from '../../lib/mockStore'
import { useAuth } from '../../contexts/AuthContext'
import type { Complaint, EscalationReason } from '../../types/database'

interface EscalateModalProps {
  complaint: Complaint
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EscalateModal({
  complaint,
  isOpen,
  onClose,
  onSuccess,
}: EscalateModalProps) {
  const { profile } = useAuth()
  const [reason, setReason] = useState<EscalationReason>('technical_support_required')
  const [notes, setNotes] = useState('')
  const [otherExplanation, setOtherExplanation] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    if (reason === 'others' && !otherExplanation.trim()) {
      toast.error('Please explain the reason for escalation under "Others".')
      return
    }

    setSubmitting(true)
    try {
      const finalNotes =
        reason === 'others'
          ? `[Others Explanation]: ${otherExplanation.trim()}\n\n${notes.trim()}`
          : notes.trim()

      if (!isSupabaseConfigured) {
        saveLocalEscalation({
          complaint_id: complaint.id,
          reason,
          additional_notes: finalNotes || null,
          escalated_by: profile.id,
          escalated_by_name: profile.full_name,
        })
        updateLocalComplaint(complaint.id, { status: 'escalated', is_escalated: true })
        appendLocalHistory({
          complaint_id: complaint.id,
          event_type: 'complaint_escalated',
          previous_status: complaint.status,
          new_status: 'escalated',
          actor_id: profile.id,
          actor_name: profile.full_name,
          notes: `Escalated to Field Intelligence. Reason: ${reason}. Notes: ${finalNotes}`,
        })
        toast.success(`Complaint ${complaint.incident_id} successfully escalated to FI!`)
        onSuccess()
        onClose()
        return
      }

      // 1. Record the escalation
      const { error: escError } = await supabase.from('escalations').upsert(
        {
          complaint_id: complaint.id,
          reason,
          additional_notes: finalNotes || null,
          escalated_by: profile.id,
          escalated_by_name: profile.full_name,
        },
        { onConflict: 'complaint_id' }
      )
      if (escError) throw escError

      // 2. Update complaint status to authoritative 'escalated'
      const { error: statusError } = await supabase
        .from('complaints')
        .update({ status: 'escalated', is_escalated: true })
        .eq('id', complaint.id)
      if (statusError) throw statusError

      // 3. Append history
      await supabase.from('complaint_history').insert({
        complaint_id: complaint.id,
        event_type: 'complaint_escalated',
        previous_status: complaint.status,
        new_status: 'escalated',
        actor_id: profile.id,
        actor_name: profile.full_name,
        notes: `Escalated to Field Intelligence. Reason: ${reason}. Notes: ${finalNotes}`,
      })

      toast.success(`Complaint ${complaint.incident_id} successfully escalated to FI!`)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Escalation failed:', err)
      toast.error(err.message || 'Failed to escalate complaint.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header matching reference screenshot */}
        <div className="p-6 bg-red-50/60 border-b border-red-100/80 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Escalate Complaint</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Provide the reason for escalation. After submitting, Field Intelligence will receive it on their dashboard.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Read-only Auto-filled Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Complaint Details (Auto-filled)
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 block">Incident ID</span>
                <span className="font-semibold text-gray-800">{complaint.incident_id}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Incident / Problem</span>
                <span className="font-semibold text-gray-800 truncate block">
                  {complaint.incident_problem}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">Chassis / VIN</span>
                <span className="font-mono text-gray-800">{complaint.chassis_vin}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Date of Report</span>
                <span className="text-gray-800">{complaint.date_of_report}</span>
              </div>
            </div>
          </div>

          {/* Reason for Escalation — 3 exact required options matching reference */}
          <div>
            <label className="form-label form-label-required">
              Reason for Escalation
            </label>
            <div className="grid grid-cols-1 gap-2.5 mt-2">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  reason === 'technical_support_required'
                    ? 'border-raptee-500 bg-raptee-50/30 ring-1 ring-raptee-500'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="escalationReason"
                  value="technical_support_required"
                  checked={reason === 'technical_support_required'}
                  onChange={() => setReason('technical_support_required')}
                  className="mt-0.5 text-raptee-500 focus:ring-raptee-500"
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Technical support required
                  </div>
                  <div className="text-xs text-gray-500">
                    Requires on-field diagnostic support from technical/FI team
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  reason === 'need_further_investigation'
                    ? 'border-raptee-500 bg-raptee-50/30 ring-1 ring-raptee-500'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="escalationReason"
                  value="need_further_investigation"
                  checked={reason === 'need_further_investigation'}
                  onChange={() => setReason('need_further_investigation')}
                  className="mt-0.5 text-raptee-500 focus:ring-raptee-500"
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Need further investigation
                  </div>
                  <div className="text-xs text-gray-500">
                    Issue needs root-cause analysis and R&D consultation
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  reason === 'others'
                    ? 'border-raptee-500 bg-raptee-50/30 ring-1 ring-raptee-500'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="escalationReason"
                  value="others"
                  checked={reason === 'others'}
                  onChange={() => setReason('others')}
                  className="mt-0.5 text-raptee-500 focus:ring-raptee-500"
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900">Others</div>
                  <div className="text-xs text-gray-500">
                    Other technical or operational escalation reasons
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Conditional explanation for Others */}
          {reason === 'others' && (
            <div>
              <label className="form-label form-label-required">
                Please explain reason for escalation
              </label>
              <input
                type="text"
                required
                placeholder="Enter mandatory explanation..."
                value={otherExplanation}
                onChange={(e) => setOtherExplanation(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          {/* Additional Notes (Max 500 characters, live count) */}
          <div>
            <div className="flex items-center justify-between">
              <label className="form-label">Additional Notes (Optional)</label>
              <span className="text-xs text-gray-400">{notes.length} / 500</span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="Enter additional details for escalation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-danger bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'Escalating...' : 'Submit & Escalate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
