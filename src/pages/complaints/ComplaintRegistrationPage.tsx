import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilePlus, Bike, Plus, Trash2, FileSpreadsheet, Settings, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import {
  saveLocalComplaintsBatch,
  appendLocalHistory,
  lookupVehicle,
  KNOWN_VEHICLES,
  getAllLocalVehicles,
} from '../../lib/mockStore'
import { useAuth } from '../../contexts/AuthContext'
import { useProblemCategories } from '../../hooks/useProblemCategories'
import ImportCustomerExcelModal from '../../components/vehicles/ImportCustomerExcelModal'
import ManageProblemCategoriesModal from '../../components/fi/ManageProblemCategoriesModal'
import type { Complaint } from '../../types/database'

const SOURCES = [
  'Customer Direct',
  'Call',
  'Whatsapp',
  'Email',
  'Other',
]
const PRIORITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const

interface IncidentItemState {
  id: string
  incidentProblem: string
  customProblem: string
  issueSummary: string
  detailedDescription: string
  incidentDate: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  photoFiles: File[]
  docFiles: File[]
}

export default function ComplaintRegistrationPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false)
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false)

  // Dynamic problem categories from hook (backed by Supabase + local fallback)
  const { categories, loading: categoriesLoading } = useProblemCategories()

  // Report & Bike Details
  const [dateOfReport, setDateOfReport] = useState(new Date().toISOString().split('T')[0])
  const [source, setSource] = useState('Customer Direct')
  const [chassisVin, setChassisVin] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [vehicleModel, setVehicleModel] = useState('Raptee HV-T30')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')

  // Supabase-loaded vehicle list for datalist dropdown
  const [remoteVehicles, setRemoteVehicles] = useState<{ chassis_vin: string; customer_name: string; registration_number: string; vehicle_model: string }[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase
      .from('customer_vehicles')
      .select('chassis_vin, customer_name, registration_number, vehicle_model')
      .order('chassis_vin', { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        console.log('[customer_vehicles load]', { count: data?.length, error })
        if (data && data.length > 0) setRemoteVehicles(data)
      })
  }, [])

  // Multiple Incidents for the same bike
  const [incidents, setIncidents] = useState<IncidentItemState[]>([
    {
      id: `inc-${Date.now()}-1`,
      incidentProblem: '',
      customProblem: '',
      issueSummary: '',
      detailedDescription: '',
      incidentDate: new Date().toISOString().split('T')[0],
      priority: 'medium',
      photoFiles: [],
      docFiles: [],
    },
  ])

  // Auto-map vehicle details when chassis number or registration number is entered or selected
  const handleChassisChange = async (vinOrReg: string) => {
    setChassisVin(vinOrReg)

    if (!vinOrReg.trim()) return

    // 1. Try local cache first (instant lookup by VIN or Reg Number)
    const localMatch = lookupVehicle(vinOrReg)
    if (localMatch) {
      setChassisVin(localMatch.chassis_vin)
      setCustomerName(localMatch.customer_name)
      setCustomerContact(localMatch.customer_contact)
      setVehicleModel(localMatch.vehicle_model)
      setRegistrationNumber(localMatch.registration_number)
      if ((localMatch as any).delivery_date) setDeliveryDate((localMatch as any).delivery_date)
      toast.success(`Vehicle details mapped for ${localMatch.customer_name} (VIN ${localMatch.chassis_vin})`)
      return
    }

    // 2. Fallback: query Supabase customer_vehicles table by VIN or Reg Number
    const cleaned = vinOrReg.trim().toUpperCase()
    if (!isSupabaseConfigured) return
    try {
      const { data, error } = await supabase
        .from('customer_vehicles')
        .select('chassis_vin, customer_name, customer_contact, vehicle_model, registration_number, delivery_date')
        .or(`chassis_vin.eq.${cleaned},registration_number.eq.${cleaned}`)
        .maybeSingle()

      console.log('[Vehicle Lookup]', { cleaned, data, error })

      if (error) {
        console.error('[Vehicle Lookup] Supabase error:', error.message)
        return
      }

      if (data) {
        setChassisVin(data.chassis_vin)
        setCustomerName(data.customer_name || '')
        setCustomerContact(data.customer_contact || '')
        setVehicleModel(data.vehicle_model || 'Raptee HV-T30')
        setRegistrationNumber(data.registration_number || '')
        if (data.delivery_date) setDeliveryDate(data.delivery_date)
        toast.success(`Vehicle details fetched for ${data.customer_name} (VIN ${data.chassis_vin})`)
      }
    } catch (err) {
      console.warn('Vehicle lookup failed:', err)
    }
  }

  // Add another incident for the same bike
  const handleAddIncident = () => {
    setIncidents((prev) => [
      ...prev,
      {
        id: `inc-${Date.now()}-${prev.length + 1}`,
        incidentProblem: '',
        customProblem: '',
        issueSummary: '',
        detailedDescription: '',
        incidentDate: new Date().toISOString().split('T')[0],
        priority: 'medium',
        photoFiles: [],
        docFiles: [],
      },
    ])
  }

  // Remove an incident block
  const handleRemoveIncident = (index: number) => {
    if (incidents.length <= 1) return
    setIncidents((prev) => prev.filter((_, i) => i !== index))
  }

  // Update specific incident field
  const updateIncidentField = (index: number, field: keyof IncidentItemState, value: any) => {
    setIncidents((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) {
      toast.error('You must be signed in to submit a complaint.')
      return
    }

    if (!chassisVin.trim()) {
      toast.error('Chassis / VIN is required.')
      return
    }

    // Validate each incident
    for (let i = 0; i < incidents.length; i++) {
      const inc = incidents[i]
      const finalProblem = inc.incidentProblem === 'Other' ? inc.customProblem.trim() : inc.incidentProblem
      if (!finalProblem) {
        toast.error(`Please select Problem for Incident #${i + 1}`)
        return
      }
      if (!inc.detailedDescription.trim()) {
        toast.error(`Please enter Detailed Description for Incident #${i + 1}`)
        return
      }
    }

    setSubmitting(true)
    try {
      const complaintPayloads = incidents.map((inc) => {
        const finalProblem = inc.incidentProblem === 'Other' ? inc.customProblem.trim() : inc.incidentProblem
        return {
          id: '',
          incident_id: '',
          date_of_report: dateOfReport,
          reported_by: profile.id,
          reported_by_name: profile.full_name,
          source,
          chassis_vin: chassisVin.trim().toUpperCase(),
          customer_name: customerName.trim() || null,
          customer_contact: customerContact.trim() || null,
          vehicle_model: vehicleModel || null,
          registration_number: registrationNumber.trim().toUpperCase() || null,
          delivery_date: deliveryDate || null,
          incident_problem: finalProblem,
          issue_summary: inc.issueSummary.trim() || null,
          detailed_description: inc.detailedDescription.trim(),
          incident_date: inc.incidentDate || null,
          incident_location: null,
          fault_code: null,
          priority: inc.priority,
          status: 'pending' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      })

      // 1. Local / Demo mode save
      if (!isSupabaseConfigured) {
        const savedBatch = saveLocalComplaintsBatch(complaintPayloads as Complaint[])

        savedBatch.forEach((c) => {
          appendLocalHistory({
            complaint_id: c.id,
            event_type: 'complaint_created',
            previous_status: null,
            new_status: 'pending',
            actor_id: profile.id,
            actor_name: profile.full_name,
            notes: `Complaint logged via CCE portal by ${profile.full_name}`,
          })
        })

        toast.success(
          savedBatch.length === 1
            ? `Complaint registered: ${savedBatch[0].incident_id}`
            : `${savedBatch.length} complaints registered for ${chassisVin}!`
        )
        navigate('/complaints')
        return
      }

      // 2. Real Supabase save
      for (let i = 0; i < complaintPayloads.length; i++) {
        const payload = complaintPayloads[i]
        const incState = incidents[i]

        const { data: newComplaint, error: insertError } = await supabase
          .from('complaints')
          .insert({
            date_of_report: payload.date_of_report,
            reported_by: profile.id,
            reported_by_name: profile.full_name,
            source: payload.source,
            chassis_vin: payload.chassis_vin,
            customer_name: payload.customer_name,
            customer_contact: payload.customer_contact,
            vehicle_model: payload.vehicle_model,
            registration_number: payload.registration_number,
            incident_problem: payload.incident_problem,
            issue_summary: payload.issue_summary,
            detailed_description: payload.detailed_description,
            incident_date: payload.incident_date,
            priority: payload.priority,
            status: 'pending',
          })
          .select()
          .single()

        if (insertError) throw insertError

        await supabase.from('complaint_history').insert({
          complaint_id: newComplaint.id,
          event_type: 'complaint_created',
          previous_status: null,
          new_status: 'pending',
          actor_id: profile.id,
          actor_name: profile.full_name,
          notes: `Complaint logged via CCE portal by ${profile.full_name}`,
        })

        // Upload attachments
        const allFiles = [...incState.photoFiles, ...incState.docFiles]
        for (const file of allFiles) {
          const fileExt = file.name.split('.').pop()
          const storagePath = `${newComplaint.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
          const { error: upErr } = await supabase.storage.from('complaint-attachments').upload(storagePath, file)
          if (!upErr) {
            await supabase.from('attachments').insert({
              complaint_id: newComplaint.id,
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

      toast.success(
        complaintPayloads.length === 1
          ? 'Complaint registered successfully!'
          : `${complaintPayloads.length} complaints registered for ${chassisVin}!`
      )
      navigate('/complaints')
    } catch (err: any) {
      console.error('Submission failed:', err)
      toast.error(err.message || 'Failed to submit complaints.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="page-header">
        <h1 className="page-title">Complaint Registration Form</h1>
        <p className="page-subtitle">
          Module 1: Enter Chassis # to auto-map bike details, and log one or more incidents for the same bike
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Bike & Customer Details (Auto-mapped via Chassis #) */}
        <div className="form-section">
          <div className="form-section-header flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-raptee-500" />
              <h2 className="form-section-title">Vehicle & Customer Details</h2>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chassis # or Reg # Input with auto-lookup */}
            <div>
              <label className="form-label form-label-required">
                Chassis / VIN # or Reg Number
              </label>
              <div className="space-y-1.5">
                <input
                  type="text"
                  required
                  list="chassis-options"
                  placeholder="Enter VIN (e.g. 24, 35) or Reg # (e.g. TN11BX4667)"
                  value={chassisVin}
                  onChange={(e) => handleChassisChange(e.target.value)}
                  className="form-input font-mono uppercase font-semibold text-gray-900 border-raptee-500/40 focus:border-raptee-500"
                />
                <datalist id="chassis-options">
                  {[
                    ...getAllLocalVehicles(),
                    ...remoteVehicles.filter(
                      (rv) => !getAllLocalVehicles().some((lv) => lv.chassis_vin === rv.chassis_vin)
                    ),
                  ].flatMap((v) => [
                    <option key={`vin-${v.chassis_vin}`} value={v.chassis_vin}>
                      VIN {v.chassis_vin}: {v.customer_name} ({v.registration_number || v.vehicle_model})
                    </option>,
                    ...(v.registration_number ? [
                      <option key={`reg-${v.chassis_vin}`} value={v.registration_number}>
                        {v.registration_number} — {v.customer_name} (VIN {v.chassis_vin})
                      </option>
                    ] : [])
                  ])}
                </datalist>

                {/* Quick Select Buttons for sample chassis */}
                {(getAllLocalVehicles().length > 0 || remoteVehicles.length > 0) ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                    <span className="text-[11px] text-gray-400">Sample VINs:</span>
                    {[
                      ...getAllLocalVehicles(),
                      ...remoteVehicles.filter(
                        (rv) => !getAllLocalVehicles().some((lv) => lv.chassis_vin === rv.chassis_vin)
                      ),
                    ].slice(0, 7).map((kv) => (
                      <button
                        type="button"
                        key={kv.chassis_vin}
                        onClick={() => handleChassisChange(kv.chassis_vin)}
                        className={`px-1.5 py-0.5 rounded font-mono text-[11px] border transition-colors ${
                          chassisVin.toUpperCase() === kv.chassis_vin
                            ? 'bg-raptee-50 border-raptee-400 text-raptee-700 font-semibold'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-600'
                        }`}
                        title={`${kv.customer_name} (${kv.registration_number})`}
                      >
                        VIN {kv.chassis_vin}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsExcelImportOpen(true)}
                      className="text-[11px] text-emerald-600 hover:text-emerald-800 font-medium underline ml-1"
                    >
                      + Import Spreadsheet
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-400 flex items-center gap-1">
                    <span>No customer vehicles loaded yet.</span>
                    <button
                      type="button"
                      onClick={() => setIsExcelImportOpen(true)}
                      className="text-emerald-600 hover:text-emerald-800 font-medium underline"
                    >
                      Import Excel (.xlsx) to enable auto-mapping
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="form-label">Customer Name</label>
              <input
                type="text"
                placeholder="Auto-mapped or enter customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="form-input bg-gray-50/50"
              />
            </div>

            <div>
              <label className="form-label">Customer Contact Number</label>
              <input
                type="tel"
                placeholder="Auto-mapped contact number"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                className="form-input bg-gray-50/50"
              />
            </div>

            <div>
              <label className="form-label">Vehicle Model / Variant</label>
              <input
                type="text"
                placeholder="Auto-mapped vehicle model"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                className="form-input bg-gray-50/50"
              />
            </div>

            <div>
              <label className="form-label">Registration Number</label>
              <input
                type="text"
                placeholder="Auto-mapped registration"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                className="form-input uppercase bg-gray-50/50 font-mono"
              />
            </div>

            <div>
              <label className="form-label">Delivery Date</label>
              <input
                type="date"
                placeholder="Auto-mapped delivery date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="form-input bg-gray-50/50"
              />
            </div>

            <div>
              <label className="form-label form-label-required">Date of Report</label>
              <input
                type="date"
                required
                value={dateOfReport}
                onChange={(e) => setDateOfReport(e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label form-label-required">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="form-input"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Reported by (CCE)</label>
              <input
                type="text"
                readOnly
                value={profile?.full_name || 'Radhika S'}
                className="form-input-readonly"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Incidents Section with (+ Incident) for same bike */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FilePlus className="w-5 h-5 text-raptee-500" />
              <h2 className="text-lg font-bold text-gray-900">
                Incident Details for this Bike ({incidents.length})
              </h2>
            </div>

            {/* (+ Incident) button */}
            <button
              type="button"
              onClick={handleAddIncident}
              className="btn-primary btn-sm bg-raptee-500 hover:bg-raptee-600 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Incident (Same Bike)</span>
            </button>
          </div>

          {incidents.map((inc, index) => (
            <div
              key={inc.id}
              className="form-section relative border-l-4 border-l-raptee-500 space-y-4 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="text-sm font-bold text-gray-800 bg-raptee-50 text-raptee-700 px-2.5 py-0.5 rounded-full border border-raptee-200">
                  Incident #{index + 1}
                </span>

                {incidents.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveIncident(index)}
                    className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 font-medium p-1 rounded hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Incident</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="form-label form-label-required mb-0">Incident / Problem</label>
                    {(profile?.role === 'field_intelligence' || profile?.role === 'admin') && (
                      <button
                        type="button"
                        onClick={() => setIsCategoriesModalOpen(true)}
                        className="text-[11px] text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1 hover:underline"
                        title="Add or remove categories as Field Intelligence"
                      >
                        <Settings className="w-3 h-3" />
                        <span>Manage Options</span>
                      </button>
                    )}
                  </div>
                  <select
                    required
                    value={inc.incidentProblem}
                    onChange={(e) => updateIncidentField(index, 'incidentProblem', e.target.value)}
                    className="form-input"
                  >
                    <option value="">- Select Problem Category -</option>
                    {categories.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {inc.incidentProblem === 'Other' && (
                    <input
                      type="text"
                      required
                      placeholder="Specify other problem"
                      value={inc.customProblem}
                      onChange={(e) => updateIncidentField(index, 'customProblem', e.target.value)}
                      className="form-input mt-2"
                    />
                  )}
                </div>

                <div>
                  <label className="form-label">Priority / Severity</label>
                  <select
                    value={inc.priority}
                    onChange={(e) => updateIncidentField(index, 'priority', e.target.value as any)}
                    className="form-input capitalize"
                  >
                    {PRIORITY_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Issue Summary (Brief)</label>
                  <input
                    type="text"
                    maxLength={120}
                    placeholder="Brief 1-line description of this incident"
                    value={inc.issueSummary}
                    onChange={(e) => updateIncidentField(index, 'issueSummary', e.target.value)}
                    className="form-input"
                  />
                  <span className="text-xs text-gray-400 block mt-1">
                    {inc.issueSummary.length}/120 characters
                  </span>
                </div>

                <div>
                  <label className="form-label">Incident Date</label>
                  <input
                    type="date"
                    value={inc.incidentDate}
                    onChange={(e) => updateIncidentField(index, 'incidentDate', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label form-label-required">
                  Detailed Description
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={1000}
                  placeholder="Describe what occurred, symptoms, customer remarks..."
                  value={inc.detailedDescription}
                  onChange={(e) => updateIncidentField(index, 'detailedDescription', e.target.value)}
                  className="form-input"
                />
                <span className="text-xs text-gray-400 block mt-1">
                  {inc.detailedDescription.length}/1000 characters
                </span>
              </div>

              {/* Attachments for this incident */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-raptee-500" />
                  <span>Attach Photos or Diagnostic Logs for this incident</span>
                </div>
                <label className="btn-secondary btn-sm cursor-pointer">
                  Select Files
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.csv,.txt,.log,video/*"
                    onChange={(e) =>
                      updateIncidentField(index, 'photoFiles', Array.from(e.target.files || []))
                    }
                    className="hidden"
                  />
                </label>
              </div>
              {inc.photoFiles.length > 0 && (
                <div className="text-xs text-emerald-600 font-medium">
                  {inc.photoFiles.length} file(s) attached to Incident #{index + 1}
                </div>
              )}
            </div>
          ))}

          {/* Bottom (+ Incident) button */}
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleAddIncident}
              className="btn-secondary btn-sm text-raptee-700 border-dashed border-raptee-400 hover:bg-raptee-50 py-2.5 px-4"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Incident for this Bike ({chassisVin || 'Chassis'})</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/complaints')}
            className="btn-secondary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting
              ? 'Submitting...'
              : incidents.length > 1
              ? `Register ${incidents.length} Complaints for Bike`
              : 'Register Complaint'}
          </button>
        </div>
      </form>

      {/* Customer Excel Import Modal */}
      <ImportCustomerExcelModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onSuccess={() => {
          if (chassisVin) {
            handleChassisChange(chassisVin)
          }
        }}
      />

      {/* Manage Problem Categories Modal (FI Role) */}
      <ManageProblemCategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
      />
    </div>
  )
}
