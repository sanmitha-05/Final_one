import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Wrench,
  Upload,
  AlertTriangle,
  Sparkles,
  Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import {
  getLocalComplaints,
  updateLocalComplaint,
  appendLocalHistory,
  saveLocalInvestigation,
  getLocalInvestigation,
  getLocalEscalation,
} from '../../lib/mockStore'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import StatusBadge from '../../components/ui/StatusBadge'
import type {
  Complaint,
  Escalation,
  FIInvestigation,
  RnDConsultation,
  ResolutionOutcome,
  RootCauseConfidence,
} from '../../types/database'

const RND_OPTIONS: { value: RnDConsultation; label: string }[] = [
  { value: 'completed', label: 'R&D Consultation Completed' },
  { value: 'required', label: 'R&D Consultation Required' },
  { value: 'technical_team', label: 'Technical Team Consultation' },
  { value: 'none', label: 'No R&D Consultation Required' },
  { value: 'other', label: 'Other' },
]

const OUTCOME_OPTIONS: { value: ResolutionOutcome; label: string }[] = [
  { value: 'fix_implemented_verified', label: 'Fix Implemented and Verified (Resolves Complaint)' },
  { value: 'recommended_fix_pending', label: 'Recommended Fix — Pending Implementation' },
  { value: 'further_investigation_required', label: 'Further Investigation Required' },
  { value: 'no_fix_identified', label: 'No Fix Identified Yet' },
  { value: 'other', label: 'Other' },
]

export default function FIResolutionPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [complaint, setComplaint] = useState<Complaint | null>(null)
  const [escalation, setEscalation] = useState<Escalation | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Investigation & Resolution fields
  const [findings, setFindings] = useState('')
  const [rootCause, setRootCause] = useState('')
  const [rootCauseConfidence, setRootCauseConfidence] = useState<RootCauseConfidence>('suspected')
  const [recommendedSolution, setRecommendedSolution] = useState('')
  const [rndConsultation, setRndConsultation] = useState<RnDConsultation>('none')
  const [consultationDetails, setConsultationDetails] = useState('')
  const [outcome, setOutcome] = useState<ResolutionOutcome>('fix_implemented_verified')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])

  useEffect(() => {
    async function loadData() {
      if (!id) return
      setLoading(true)
      try {
        if (!isSupabaseConfigured) {
          const comp = getLocalComplaints().find((c) => c.id === id)
          if (comp) {
            setComplaint(comp)
            setEscalation(getLocalEscalation(id))
            const inv = getLocalInvestigation(id)
            if (inv) {
              setFindings(inv.investigation_findings || '')
              setRootCause(inv.root_cause || '')
              setRootCauseConfidence(inv.root_cause_confidence || 'suspected')
              setRecommendedSolution(inv.recommended_solution || '')
              setRndConsultation(inv.rnd_consultation || 'none')
              setConsultationDetails(inv.consultation_details || '')
              setOutcome(inv.resolution_outcome || 'recommended_fix_pending')
              setAdditionalNotes(inv.additional_notes || '')
            }
            setLoading(false)
            return
          }
        }

        const [compRes, escRes, invRes] = await Promise.all([
          supabase.from('complaints').select('*').eq('id', id).single(),
          supabase.from('escalations').select('*').eq('complaint_id', id).maybeSingle(),
          supabase.from('fi_investigations').select('*').eq('complaint_id', id).maybeSingle(),
        ])

        if (compRes.error) {
          const comp = getLocalComplaints().find((c) => c.id === id)
          if (comp) {
            setComplaint(comp)
            setEscalation(getLocalEscalation(id))
          } else {
            throw compRes.error
          }
        } else {
          setComplaint(compRes.data)
          if (escRes.data) setEscalation(escRes.data)
        }

        // Load existing investigation if returning to edit
        if (invRes.data) {
          const inv = invRes.data
          setFindings(inv.investigation_findings || '')
          setRootCause(inv.root_cause || '')
          setRootCauseConfidence(inv.root_cause_confidence || 'suspected')
          setRecommendedSolution(inv.recommended_solution || '')
          setRndConsultation(inv.rnd_consultation || 'none')
          setConsultationDetails(inv.consultation_details || '')
          setOutcome(inv.resolution_outcome || 'recommended_fix_pending')
          setAdditionalNotes(inv.additional_notes || '')
        }
      } catch (err: any) {
        toast.error('Failed to load complaint data.')
        navigate('/fi/dashboard')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!complaint || !profile) return

    if (!recommendedSolution.trim()) {
      toast.error('Solution / Recommended Fix is required.')
      return
    }

    if (
      (rndConsultation === 'completed' || rndConsultation === 'required') &&
      !consultationDetails.trim()
    ) {
      toast.error('Consultation details are required when R&D consultation is active.')
      return
    }

    setSubmitting(true)
    try {
      let newComplaintStatus: any = 'in_progress'
      if (outcome === 'fix_implemented_verified') {
        newComplaintStatus = 'resolved'
      } else if (outcome === 'no_fix_identified') {
        newComplaintStatus = 'not_resolved'
      } else {
        newComplaintStatus = 'in_progress'
      }

      if (!isSupabaseConfigured) {
        saveLocalInvestigation({
          complaint_id: complaint.id,
          investigation_findings: findings.trim() || null,
          root_cause: rootCause.trim() || null,
          root_cause_confidence: rootCauseConfidence,
          recommended_solution: recommendedSolution.trim(),
          rnd_consultation: rndConsultation,
          consultation_details: consultationDetails.trim() || null,
          resolution_outcome: outcome,
          additional_notes: additionalNotes.trim() || null,
          submitted_by: profile.id,
          submitted_by_name: profile.full_name,
        })

        updateLocalComplaint(complaint.id, { status: newComplaintStatus, is_escalated: true })

        appendLocalHistory({
          complaint_id: complaint.id,
          event_type:
            outcome === 'fix_implemented_verified'
              ? 'fi_resolution_verified_closure'
              : 'fi_investigation_updated',
          previous_status: complaint.status,
          new_status: newComplaintStatus,
          actor_id: profile.id,
          actor_name: profile.full_name,
          notes: `FI Investigation recorded by ${profile.full_name}. Outcome: ${outcome}. Solution: ${recommendedSolution}`,
        })

        toast.success(
          outcome === 'fix_implemented_verified'
            ? `Complaint ${complaint.incident_id} verified and marked as Resolved!`
            : `FI investigation saved. Complaint remains in progress for verification.`
        )
        navigate('/fi/dashboard')
        return
      }

      // 1. Upsert FI Investigation
      const { data: invData, error: invError } = await supabase
        .from('fi_investigations')
        .upsert(
          {
            complaint_id: complaint.id,
            investigation_findings: findings.trim() || null,
            root_cause: rootCause.trim() || null,
            root_cause_confidence: rootCauseConfidence,
            recommended_solution: recommendedSolution.trim(),
            rnd_consultation: rndConsultation,
            consultation_details: consultationDetails.trim() || null,
            resolution_outcome: outcome,
            additional_notes: additionalNotes.trim() || null,
            submitted_by: profile.id,
            submitted_by_name: profile.full_name,
          },
          { onConflict: 'complaint_id' }
        )
        .select()
        .single()

      if (invError) throw invError

      // 2. Strict status transition logic (Module 6 & 7 rule: recommendation != proof of resolution)
      const { error: statusError } = await supabase
        .from('complaints')
        .update({ status: newComplaintStatus, is_escalated: true })
        .eq('id', complaint.id)

      if (statusError) throw statusError

      // 3. Upload evidence files to fi-evidence bucket
      if (evidenceFiles.length > 0 && invData) {
        for (const file of evidenceFiles) {
          const fileExt = file.name.split('.').pop()
          const storagePath = `fi_${complaint.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
          const { error: upErr } = await supabase.storage
            .from('fi-evidence')
            .upload(storagePath, file)

          if (!upErr) {
            await supabase.from('attachments').insert({
              complaint_id: complaint.id,
              investigation_id: invData.id,
              storage_path: storagePath,
              original_filename: file.name,
              mime_type: file.type || 'application/octet-stream',
              file_size: file.size,
              uploaded_by: profile.id,
              uploaded_by_name: profile.full_name,
            })
          }
        }
      }

      // 4. Append history record
      await supabase.from('complaint_history').insert({
        complaint_id: complaint.id,
        event_type:
          outcome === 'fix_implemented_verified'
            ? 'fi_resolution_verified_closure'
            : 'fi_investigation_updated',
        previous_status: complaint.status,
        new_status: newComplaintStatus,
        actor_id: profile.id,
        actor_name: profile.full_name,
        notes: `FI Investigation recorded by ${profile.full_name}. Outcome: ${outcome}. Solution: ${recommendedSolution}`,
      })

      toast.success(
        outcome === 'fix_implemented_verified'
          ? `Complaint ${complaint.incident_id} verified and marked as Resolved!`
          : `FI investigation saved. Complaint remains in progress for verification.`
      )
      navigate('/fi/dashboard')
    } catch (err: any) {
      console.error('FI Submission failed:', err)
      toast.error(err.message || 'Failed to submit FI investigation.')
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
      {/* Back link */}
      <Link
        to="/fi/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to FI Report</span>
      </Link>

      {/* Header matching reference */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Field Intelligence Resolution Form
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Record the investigation findings and recommended solution for the complaint.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={complaint.status} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Auto-filled Complaint Details */}
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

        {/* Section 2: Escalation Info Context */}
        {escalation && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              CCE Escalation Context (Read-Only)
            </div>
            <div className="text-xs text-amber-800">
              <span className="font-semibold">Reason: </span>
              <span className="capitalize">{escalation.reason.replace(/_/g, ' ')}</span>
              {escalation.additional_notes && (
                <div className="mt-1 bg-white/60 p-2.5 rounded-lg border border-amber-200/50">
                  {escalation.additional_notes}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 3: Investigation Findings & Root Cause */}
        <div className="form-section">
          <div className="form-section-header">
            <Wrench className="w-5 h-5 text-teal-600" />
            <h2 className="form-section-title">Investigation & Root Cause Analysis</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label">Investigation Findings</label>
              <textarea
                rows={3}
                placeholder="Observed hardware/software symptoms, diagnostic tool measurements, CAN log telemetry..."
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="form-label">Suspected / Confirmed Root Cause</label>
                <input
                  type="text"
                  placeholder="e.g. BMS firmware watchdog reset due to SPI bus noise"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Confidence Level</label>
                <div className="flex items-center gap-3 mt-2">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="confidence"
                      value="suspected"
                      checked={rootCauseConfidence === 'suspected'}
                      onChange={() => setRootCauseConfidence('suspected')}
                      className="text-teal-600"
                    />
                    <span>Suspected</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="confidence"
                      value="confirmed"
                      checked={rootCauseConfidence === 'confirmed'}
                      onChange={() => setRootCauseConfidence('confirmed')}
                      className="text-teal-600"
                    />
                    <span>Confirmed</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Resolution & R&D Inputs */}
        <div className="form-section">
          <div className="form-section-header">
            <CheckCircle2 className="w-5 h-5 text-teal-600" />
            <h2 className="form-section-title">Resolution Details & R&D Consultation</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label form-label-required">
                Solution / Recommended Fix
              </label>
              <textarea
                required
                rows={3}
                placeholder="Enter the recommended solution or fix to apply..."
                value={recommendedSolution}
                onChange={(e) => setRecommendedSolution(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label form-label-required">
                  R&D Inputs / Consultation
                </label>
                <select
                  value={rndConsultation}
                  onChange={(e) => setRndConsultation(e.target.value as any)}
                  className="form-input"
                  required
                >
                  {RND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label form-label-required">
                  Resolution Outcome
                </label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as any)}
                  className="form-input font-medium"
                  required
                >
                  {OUTCOME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Status indicator callout */}
                <div className="mt-2 text-xs">
                  {outcome === 'fix_implemented_verified' && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>This complaint will be marked as <strong>RESOLVED</strong> across all dashboards.</span>
                    </div>
                  )}
                  {outcome === 'recommended_fix_pending' && (
                    <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-medium flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Status will be <strong>IN PROGRESS</strong>. The service team can implement this fix and verify closure.</span>
                    </div>
                  )}
                  {outcome === 'further_investigation_required' && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Status will remain <strong>IN PROGRESS</strong> pending further diagnostic tests.</span>
                    </div>
                  )}
                  {outcome === 'no_fix_identified' && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 font-medium">
                      Status will be marked as <strong>NOT RESOLVED</strong>.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(rndConsultation === 'completed' || rndConsultation === 'required') && (
              <div>
                <label className="form-label form-label-required">
                  Consultation Details
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter R&D consultation details (discussion, engineer suggestions, firmware patch version, next steps)..."
                  value={consultationDetails}
                  onChange={(e) => setConsultationDetails(e.target.value)}
                  className="form-input"
                />
              </div>
            )}

            <div>
              <label className="form-label">Additional Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="Any further notes or instructions for the service center..."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                className="form-input"
              />
            </div>

            {/* Evidence File Upload */}
            <div>
              <label className="form-label">Technical Evidence / Attachments</label>
              <div className="border border-dashed border-gray-300 rounded-xl p-3 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Upload className="w-4 h-4 text-teal-600" />
                  <span>Attach diagnostic logs, oscillograms, or repair photos</span>
                </div>
                <label className="btn-secondary btn-sm cursor-pointer">
                  Select Files
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setEvidenceFiles(Array.from(e.target.files || []))}
                    className="hidden"
                  />
                </label>
              </div>
              {evidenceFiles.length > 0 && (
                <div className="mt-1 text-xs text-teal-600 font-medium">
                  {evidenceFiles.length} file(s) attached
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buttons matching reference */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/fi/dashboard')}
            disabled={submitting}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`btn-primary ${
              outcome === 'fix_implemented_verified'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {submitting
              ? 'Saving...'
              : outcome === 'fix_implemented_verified'
              ? 'Submit & Mark Complaint as Resolved'
              : 'Save Investigation (Status: In Progress)'}
          </button>
        </div>
      </form>
    </div>
  )
}
