import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { getLocalComplaints, updateLocalComplaint, appendLocalHistory } from '../../lib/mockStore'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import StatusBadge from '../../components/ui/StatusBadge'
import type { Complaint, ActionTaken } from '../../types/database'

const ACTION_OPTIONS: { value: ActionTaken; label: string }[] = [
  { value: 'software_update', label: 'Software Update' },
  { value: 'component_replacement', label: 'Component Replacement' },
  { value: 'repair_adjustment', label: 'Repair / Adjustment' },
  { value: 'inspection_diagnosis', label: 'Inspection / Diagnosis' },
  { value: 'customer_guidance', label: 'Customer Guidance' },
  { value: 'other', label: 'Other' },
]

export default function CCEResolutionPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [complaint, setComplaint] = useState<Complaint | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Resolution Form fields
  const [actionTaken, setActionTaken] = useState<ActionTaken>('software_update')
  const [actionDetails, setActionDetails] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [communicatedToCustomer, setCommunicatedToCustomer] = useState(true)

  useEffect(() => {
    async function loadComplaint() {
      if (!id) return
      setLoading(true)
      try {
        if (!isSupabaseConfigured) {
          const found = getLocalComplaints().find((c) => c.id === id)
          if (found) {
            setComplaint(found)
            setLoading(false)
            return
          }
        }

        const { data, error } = await supabase
          .from('complaints')
          .select('*')
          .eq('id', id)
          .single()

        if (error) {
          const found = getLocalComplaints().find((c) => c.id === id)
          if (found) setComplaint(found)
          else throw error
        } else {
          setComplaint(data)
        }
      } catch (err: any) {
        toast.error('Failed to load complaint details.')
        navigate('/complaints')
      } finally {
        setLoading(false)
      }
    }
    loadComplaint()
  }, [id, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!complaint || !profile) return

    if (!actionDetails.trim()) {
      toast.error('Action details are required.')
      return
    }

    setSubmitting(true)
    try {
      if (!isSupabaseConfigured) {
        updateLocalComplaint(complaint.id, {
          status: 'resolved',
          is_escalated: false,
          communicated_to_customer: communicatedToCustomer,
          communicated_at: communicatedToCustomer ? new Date().toISOString() : null,
          communicated_by: communicatedToCustomer ? profile.id : null,
          communicated_by_name: communicatedToCustomer ? profile.full_name : null,
        })
        appendLocalHistory({
          complaint_id: complaint.id,
          event_type: 'cce_resolution_submitted',
          previous_status: complaint.status,
          new_status: 'resolved',
          actor_id: profile.id,
          actor_name: profile.full_name,
          notes: `CCE Resolution recorded: ${actionTaken}. Action: ${actionDetails.trim()}. Customer Communicated: ${communicatedToCustomer ? 'Yes' : 'No'}`,
        })
        toast.success(`Complaint ${complaint.incident_id} successfully marked as Resolved!`)
        navigate('/complaints')
        return
      }

      // 1. Record CCE Resolution
      const { error: resError } = await supabase.from('cce_resolutions').insert({
        complaint_id: complaint.id,
        action_taken: actionTaken,
        action_details: actionDetails.trim(),
        resolved_by: profile.id,
        resolved_by_name: profile.full_name,
        additional_notes: additionalNotes.trim() || null,
      })
      if (resError) throw resError

      // 2. Mark complaint as authoritative 'resolved'
      const { error: updateError } = await supabase
        .from('complaints')
        .update({
          status: 'resolved',
          is_escalated: false,
          communicated_to_customer: communicatedToCustomer,
          communicated_at: communicatedToCustomer ? new Date().toISOString() : null,
          communicated_by: communicatedToCustomer ? profile.id : null,
          communicated_by_name: communicatedToCustomer ? profile.full_name : null,
        })
        .eq('id', complaint.id)
      if (updateError) throw updateError

      // 3. Append history
      await supabase.from('complaint_history').insert({
        complaint_id: complaint.id,
        event_type: 'cce_resolution_submitted',
        previous_status: complaint.status,
        new_status: 'resolved',
        actor_id: profile.id,
        actor_name: profile.full_name,
        notes: `CCE Resolution recorded: ${actionTaken}. Action: ${actionDetails.trim()}. Customer Communicated: ${communicatedToCustomer ? 'Yes' : 'No'}`,
      })

      toast.success(`Complaint ${complaint.incident_id} successfully marked as Resolved!`)
      navigate('/complaints')
    } catch (err: any) {
      console.error('CCE Resolution failed:', err)
      toast.error(err.message || 'Failed to submit resolution.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!complaint) return null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation Back */}
      <Link
        to="/complaints"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-raptee-600 hover:text-raptee-700"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Complaint Report</span>
      </Link>

      {/* Header matching reference screenshot */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CCE Resolution Form</h1>
          <p className="text-sm text-gray-500 mt-1">
            Update the resolution details for the complaint.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={complaint.status} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Complaint Details (Auto-filled, Read-only) */}
        <div className="form-section">
          <div className="form-section-header">
            <h2 className="form-section-title">Complaint Details (Auto-filled)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Incident ID</label>
              <input
                type="text"
                readOnly
                value={complaint.incident_id}
                className="form-input-readonly font-mono font-semibold"
              />
            </div>

            <div>
              <label className="form-label">Chassis / VIN</label>
              <input
                type="text"
                readOnly
                value={complaint.chassis_vin}
                className="form-input-readonly font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="form-label">Original Complaint</label>
              <textarea
                readOnly
                rows={3}
                value={complaint.detailed_description}
                className="form-input-readonly"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Resolution Details */}
        <div className="form-section">
          <div className="form-section-header">
            <CheckCircle2 className="w-5 h-5 text-raptee-500" />
            <h2 className="form-section-title">Resolution Details</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label">Issue Summary (Auto-fetched)</label>
              <input
                type="text"
                readOnly
                value={complaint.issue_summary || complaint.incident_problem}
                className="form-input-readonly"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label form-label-required">Action Taken</label>
                <select
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value as ActionTaken)}
                  className="form-input"
                  required
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label form-label-required">Resolved By</label>
                <input
                  type="text"
                  readOnly
                  value={profile?.full_name || 'Radhika S'}
                  className="form-input-readonly"
                />
              </div>
            </div>

            <div>
              <label className="form-label form-label-required">Action Details</label>
              <textarea
                required
                rows={4}
                placeholder="Enter detailed action taken to resolve this customer issue..."
                value={actionDetails}
                onChange={(e) => setActionDetails(e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Additional Notes (Optional)</label>
              <textarea
                rows={3}
                placeholder="Any follow-up recommendations, warranty notes, customer instructions..."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                className="form-input"
              />
            </div>

            {/* Customer Communication Checkbox for CCE */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Customer Communication</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  Confirm if the resolution details have been explained/delivered to the customer
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-emerald-300 shadow-xs hover:bg-emerald-50/40">
                <input
                  type="checkbox"
                  checked={communicatedToCustomer}
                  onChange={(e) => setCommunicatedToCustomer(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-emerald-800">
                  {communicatedToCustomer ? '✓ Communicated to Customer' : 'Pending Customer Call'}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Form Actions matching reference */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/complaints')}
            disabled={submitting}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Submitting...' : 'Submit Resolution'}
          </button>
        </div>
      </form>
    </div>
  )
}
