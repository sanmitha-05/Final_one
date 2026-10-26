import { useState, useEffect } from 'react'
import { X, Clock, User, Shield, Paperclip, AlertTriangle, CheckCircle2, Wrench } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { getLocalHistory, getLocalEscalation, getLocalInvestigation, updateLocalComplaint, appendLocalHistory } from '../../lib/mockStore'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge from '../ui/StatusBadge'
import LoadingSpinner from '../ui/LoadingSpinner'
import type { Complaint, ComplaintHistory, Attachment, Escalation, FIInvestigation } from '../../types/database'

interface ComplaintDetailModalProps {
  complaint: Complaint
  isOpen: boolean
  onClose: () => void
}

export default function ComplaintDetailModal({
  complaint,
  isOpen,
  onClose,
}: ComplaintDetailModalProps) {
  const { profile } = useAuth()
  const [history, setHistory] = useState<ComplaintHistory[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [escalation, setEscalation] = useState<Escalation | null>(null)
  const [investigation, setInvestigation] = useState<FIInvestigation | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    async function loadDetails() {
      setLoading(true)
      try {
        if (!isSupabaseConfigured) {
          const hist = getLocalHistory(complaint.id)
          const esc = getLocalEscalation(complaint.id)
          const inv = getLocalInvestigation(complaint.id)
          setHistory(hist)
          setEscalation(esc)
          setInvestigation(inv)
          setLoading(false)
          return
        }

        const [histRes, attRes, escRes, invRes] = await Promise.all([
          supabase
            .from('complaint_history')
            .select('*')
            .eq('complaint_id', complaint.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('attachments')
            .select('*')
            .eq('complaint_id', complaint.id),
          supabase
            .from('escalations')
            .select('*')
            .eq('complaint_id', complaint.id)
            .maybeSingle(),
          supabase
            .from('fi_investigations')
            .select('*')
            .eq('complaint_id', complaint.id)
            .maybeSingle(),
        ])

        if (histRes.data) setHistory(histRes.data)
        if (attRes.data) setAttachments(attRes.data)
        if (escRes.data) setEscalation(escRes.data)
        if (invRes.data) setInvestigation(invRes.data)
      } catch (err) {
        console.error('Error loading details:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDetails()
  }, [complaint.id, isOpen])

  const handleVerifyResolution = async () => {
    setVerifying(true)
    try {
      if (!isSupabaseConfigured) {
        updateLocalComplaint(complaint.id, { status: 'resolved', is_escalated: true })
        appendLocalHistory({
          complaint_id: complaint.id,
          event_type: 'fi_resolution_verified_closure',
          previous_status: complaint.status,
          new_status: 'resolved',
          actor_id: profile?.id || 'demo',
          actor_name: profile?.full_name || 'Team Member',
          notes: 'Fix verified on bike. Complaint marked as Resolved.',
        })
        toast.success(`Complaint ${complaint.incident_id} verified and marked as Resolved!`)
        onClose()
        window.location.reload()
        return
      }

      await supabase.from('complaints').update({ status: 'resolved', is_escalated: true }).eq('id', complaint.id)
      await supabase.from('complaint_history').insert({
        complaint_id: complaint.id,
        event_type: 'fi_resolution_verified_closure',
        previous_status: complaint.status,
        new_status: 'resolved',
        actor_id: profile?.id || '',
        actor_name: profile?.full_name || '',
        notes: 'Fix verified on bike. Complaint marked as Resolved.',
      })
      toast.success(`Complaint ${complaint.incident_id} verified and marked as Resolved!`)
      onClose()
      window.location.reload()
    } catch (err: any) {
      toast.error('Failed to verify: ' + err.message)
    } finally {
      setVerifying(false)
    }
  }

  const [commStatus, setCommStatus] = useState<boolean>(complaint.communicated_to_customer ?? false)

  const handleToggleCommunication = async () => {
    const newStatus = !commStatus
    try {
      if (!isSupabaseConfigured) {
        updateLocalComplaint(complaint.id, {
          communicated_to_customer: newStatus,
          communicated_at: newStatus ? new Date().toISOString() : null,
          communicated_by: newStatus ? profile?.id : null,
          communicated_by_name: newStatus ? profile?.full_name : null,
        })
        appendLocalHistory({
          complaint_id: complaint.id,
          event_type: 'customer_communication_updated',
          previous_status: complaint.status,
          new_status: complaint.status,
          actor_id: profile?.id || 'cce',
          actor_name: profile?.full_name || 'CCE',
          notes: `Customer communication marked as: ${newStatus ? 'Yes (Communicated)' : 'Pending'} by ${profile?.full_name || 'CCE'}`,
        })
        setCommStatus(newStatus)
        toast.success(newStatus ? 'Customer communication confirmed!' : 'Communication reset to pending')
        return
      }

      await supabase
        .from('complaints')
        .update({
          communicated_to_customer: newStatus,
          communicated_at: newStatus ? new Date().toISOString() : null,
          communicated_by: newStatus ? profile?.id : null,
          communicated_by_name: newStatus ? profile?.full_name : null,
        })
        .eq('id', complaint.id)

      await supabase.from('complaint_history').insert({
        complaint_id: complaint.id,
        event_type: 'customer_communication_updated',
        previous_status: complaint.status,
        new_status: complaint.status,
        actor_id: profile?.id || 'cce',
        actor_name: profile?.full_name || 'CCE',
        notes: `Customer communication marked as: ${newStatus ? 'Yes (Communicated)' : 'Pending'} by ${profile?.full_name || 'CCE'}`,
      })

      setCommStatus(newStatus)
      toast.success(newStatus ? 'Customer communication confirmed!' : 'Communication reset to pending')
    } catch (err: any) {
      toast.error('Failed to update communication status: ' + err.message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-mono tracking-tight">
                  {complaint.incident_id}
                </h2>
                <StatusBadge status={complaint.status} isEscalated={complaint.is_escalated || !!escalation} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Chassis: <span className="font-mono text-gray-300">{complaint.chassis_vin}</span> • Reported {complaint.date_of_report}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white rounded-lg p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              {/* Complaint Overview */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Vehicle & Customer Information
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block">Customer</span>
                    <span className="font-medium text-gray-800">
                      {complaint.customer_name || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Contact</span>
                    <span className="font-medium text-gray-800">
                      {complaint.customer_contact || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Model</span>
                    <span className="font-medium text-gray-800">
                      {complaint.vehicle_model || 'Raptee.HV'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Reported By</span>
                    <span className="font-medium text-gray-800">
                      {complaint.reported_by_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Source</span>
                    <span className="font-medium text-gray-800">
                      {complaint.source || 'Direct'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Fault Code</span>
                    <span className="font-mono font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs inline-block">
                      {complaint.fault_code || 'None'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Communication Status for Resolved Complaints */}
              {complaint.status === 'resolved' && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        commStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">
                        Customer Communication: {commStatus ? 'Communicated ✓' : 'Pending Customer Communication'}
                      </div>
                      <div className="text-xs text-gray-600">
                        {commStatus
                          ? 'CCE has communicated this resolution to the customer'
                          : 'Resolution has not yet been confirmed with customer by CCE'}
                      </div>
                    </div>
                  </div>
                  {(profile?.role === 'cce' || profile?.role === 'admin') && (
                    <button
                      type="button"
                      onClick={handleToggleCommunication}
                      className={`btn-sm text-xs font-bold transition-all shadow-xs ${
                        commStatus
                          ? 'btn-secondary text-gray-700 hover:text-red-700 hover:bg-red-50 hover:border-red-200'
                          : 'btn-primary bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {commStatus ? 'Reset to Pending' : '✓ Mark Communicated'}
                    </button>
                  )}
                </div>
              )}

              {/* Problem Description */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Incident: {complaint.incident_problem}
                </h3>
                {complaint.issue_summary && (
                  <p className="text-sm text-gray-600 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                    "{complaint.issue_summary}"
                  </p>
                )}
                <div className="text-sm text-gray-700 whitespace-pre-line bg-white p-4 rounded-xl border border-gray-200">
                  {complaint.detailed_description}
                </div>
              </div>

              {/* Escalation details if present */}
              {escalation && (
                <div className="bg-pink-50/60 border border-pink-200/80 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-pink-800 font-semibold text-sm">
                    <AlertTriangle className="w-4 h-4 text-pink-600" />
                    Field Intelligence Escalation Details
                  </div>
                  <div className="text-xs text-pink-900">
                    <span className="font-medium">Reason: </span>
                    <span className="capitalize">{escalation.reason.replace(/_/g, ' ')}</span>
                  </div>
                  {escalation.additional_notes && (
                    <div className="text-xs text-pink-800 bg-white/70 p-3 rounded-lg border border-pink-100 whitespace-pre-line">
                      {escalation.additional_notes}
                    </div>
                  )}
                  <div className="text-[11px] text-pink-700">
                    Escalated by {escalation.escalated_by_name} on{' '}
                    {new Date(escalation.escalated_at).toLocaleString()}
                  </div>
                </div>
              )}

              {/* FI Investigation details if present */}
              {investigation && (
                <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-teal-900 font-semibold text-sm">
                    <Wrench className="w-4 h-4 text-teal-700" />
                    Field Intelligence Investigation & Recommended Solution
                  </div>
                  {investigation.investigation_findings && (
                    <div className="text-xs text-teal-900">
                      <span className="font-semibold">Findings: </span>
                      {investigation.investigation_findings}
                    </div>
                  )}
                  {investigation.root_cause && (
                    <div className="text-xs text-teal-900">
                      <span className="font-semibold">Root Cause ({investigation.root_cause_confidence || 'suspected'}): </span>
                      {investigation.root_cause}
                    </div>
                  )}
                  {investigation.recommended_solution && (
                    <div className="text-xs bg-white/80 p-2.5 rounded-lg border border-teal-200 text-teal-950 font-medium">
                      <span className="font-semibold text-teal-900 block mb-0.5">Recommended Fix:</span>
                      {investigation.recommended_solution}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-teal-700 pt-1">
                    <span>Outcome: <strong className="capitalize">{investigation.resolution_outcome.replace(/_/g, ' ')}</strong></span>
                    <span>By {investigation.submitted_by_name}</span>
                  </div>
                </div>
              )}

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Linked Attachments ({attachments.length})
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-xs"
                      >
                        <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="truncate font-medium text-gray-700 flex-1">
                          {att.original_filename}
                        </span>
                        <span className="text-gray-400 text-[10px]">
                          {(att.file_size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit / Timeline History (Module 7) */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Authoritative History Timeline
                </h4>
                <div className="border-l-2 border-gray-200 ml-3 space-y-4 pl-4 py-1">
                  {history.map((h) => (
                    <div key={h.id} className="relative text-xs">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-raptee-500 ring-4 ring-white" />
                      <div className="font-semibold text-gray-800 capitalize">
                        {h.event_type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-gray-500 mt-0.5">{h.notes}</div>
                      <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-2">
                        <span>{new Date(h.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span>By {h.actor_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <div>
            {complaint.status !== 'resolved' && (
              <span className="text-xs text-gray-500">
                Action required: Verify the fix on the bike to close this complaint.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary btn-sm">
              Close
            </button>
            {complaint.status !== 'resolved' && (
              <button
                onClick={handleVerifyResolution}
                disabled={verifying}
                className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{verifying ? 'Closing...' : 'Verify Fix & Close Complaint'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
