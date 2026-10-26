import type { Complaint, ComplaintHistory, Escalation, CCEResolution, FIInvestigation } from '../types/database'
import customerSeedData from './rapteeCustomersData.json'

// Vehicle Registry for auto-mapping when Chassis / VIN is entered
export interface VehicleRegistryRecord {
  chassis_vin: string
  customer_name: string
  customer_contact: string
  vehicle_model: string
  registration_number: string
  delivery_date?: string | null
}

// 80 verified Raptee customer vehicles from CCE register
export const KNOWN_VEHICLES: VehicleRegistryRecord[] = customerSeedData as VehicleRegistryRecord[]

export const DEFAULT_PROBLEM_CATEGORIES: string[] = [
  'Vehicle not turning ON',
  'Charging issue',
  'App login issue',
  'Error code issue',
  'Display not working',
  'BMS issue',
  'App connectivity issue',
  'Unexpected shutdown',
  'Regenerative braking failure',
  'Throttle response delayed',
  'Fast charging communication timeout',
  'High voltage isolation warning',
  'Motor Vibration / Unusual Noise',
  'Keyless Start / Smart Key Failure',
  'Other',
]

const VEHICLES_STORAGE_KEY = 'raptee_customer_vehicles_v2'
const CATEGORIES_STORAGE_KEY = 'raptee_problem_categories_v2'

export function getAllLocalVehicles(): VehicleRegistryRecord[] {
  try {
    const raw = localStorage.getItem(VEHICLES_STORAGE_KEY)
    if (!raw) {
      return KNOWN_VEHICLES
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : KNOWN_VEHICLES
  } catch {
    return KNOWN_VEHICLES
  }
}

export function saveLocalVehiclesBatch(newVehicles: VehicleRegistryRecord[]): VehicleRegistryRecord[] {
  const current = getAllLocalVehicles()
  const map = new Map<string, VehicleRegistryRecord>()

  // Keep existing
  current.forEach((v) => map.set(v.chassis_vin.toUpperCase(), v))
  // Upsert new
  newVehicles.forEach((v) => {
    if (v.chassis_vin) {
      map.set(v.chassis_vin.toUpperCase(), {
        chassis_vin: v.chassis_vin.trim().toUpperCase(),
        customer_name: v.customer_name?.trim() || '',
        customer_contact: v.customer_contact?.trim() || '',
        vehicle_model: v.vehicle_model?.trim() || 'Raptee.HV',
        registration_number: v.registration_number?.trim().toUpperCase() || '',
      })
    }
  })

  const merged = Array.from(map.values())
  localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(merged))
  return merged
}

export function getLocalProblemCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(DEFAULT_PROBLEM_CATEGORIES))
      return DEFAULT_PROBLEM_CATEGORIES
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROBLEM_CATEGORIES
  } catch {
    return DEFAULT_PROBLEM_CATEGORIES
  }
}

export function addLocalProblemCategory(name: string): string[] {
  const current = getLocalProblemCategories()
  const trimmed = name.trim()
  if (!trimmed || current.includes(trimmed)) return current

  // Keep 'Other' at the end if present
  const withoutOther = current.filter((c) => c !== 'Other')
  const updated = [...withoutOther, trimmed, 'Other']
  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function removeLocalProblemCategory(name: string): string[] {
  const current = getLocalProblemCategories()
  if (name === 'Other') return current // Keep 'Other' as safe fallback
  const updated = current.filter((c) => c !== name)
  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function lookupVehicle(searchQuery: string): VehicleRegistryRecord | null {
  if (!searchQuery) return null
  const cleaned = searchQuery.trim().toUpperCase()
  const cleanedNoSpaces = cleaned.replace(/[\s-]/g, '')

  // 1. Check local imported vehicles first (by Chassis VIN or Registration Number)
  const allVehicles = getAllLocalVehicles()
  const found = allVehicles.find((v) => {
    const vVin = v.chassis_vin.toUpperCase().trim()
    const vReg = (v.registration_number || '').toUpperCase().trim()
    const vRegNoSpaces = vReg.replace(/[\s-]/g, '')

    return (
      vVin === cleaned ||
      vReg === cleaned ||
      (cleanedNoSpaces.length >= 3 && vRegNoSpaces === cleanedNoSpaces)
    )
  })
  if (found) return found

  // 2. Fallback check registered complaints
  const complaints = getLocalComplaints()
  const match = complaints.find((c) => {
    const cVin = c.chassis_vin.toUpperCase().trim()
    const cReg = (c.registration_number || '').toUpperCase().trim()
    return cVin === cleaned || cReg === cleaned
  })
  if (match) {
    return {
      chassis_vin: match.chassis_vin,
      customer_name: match.customer_name || '',
      customer_contact: match.customer_contact || '',
      vehicle_model: match.vehicle_model || 'Raptee.HV',
      registration_number: match.registration_number || '',
    }
  }

  return null
}

// NO pre-built complaints — starts completely clean
const INITIAL_COMPLAINTS: Complaint[] = []

const STORAGE_KEY = 'raptee_complaints_store_v2'
const HISTORY_KEY = 'raptee_history_store_v2'
const ESCALATIONS_KEY = 'raptee_escalations_store_v2'
const INVESTIGATIONS_KEY = 'raptee_investigations_store_v2'

export function getLocalComplaints(): Complaint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_COMPLAINTS))
      return INITIAL_COMPLAINTS
    }
    return JSON.parse(raw)
  } catch {
    return INITIAL_COMPLAINTS
  }
}

export function saveLocalComplaint(complaint: Complaint): Complaint {
  const current = getLocalComplaints()
  const year = new Date().getFullYear()
  const nextSeq = current.length + 1
  const incidentId = complaint.incident_id || `CI-${year}-${String(nextSeq).padStart(4, '0')}`

  const newEntry: Complaint = {
    ...complaint,
    id: complaint.id || `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    incident_id: incidentId,
    is_escalated: complaint.is_escalated ?? false,
    communicated_to_customer: complaint.communicated_to_customer ?? false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const updated = [newEntry, ...current]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return newEntry
}

export function saveLocalComplaintsBatch(complaints: Complaint[]): Complaint[] {
  const current = getLocalComplaints()
  const year = new Date().getFullYear()
  let nextSeq = current.length + 1

  const newEntries: Complaint[] = complaints.map((c, i) => {
    const seq = nextSeq + i
    const incidentId = c.incident_id || `CI-${year}-${String(seq).padStart(4, '0')}`
    return {
      ...c,
      id: c.id || `c-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
      incident_id: incidentId,
      is_escalated: c.is_escalated ?? false,
      communicated_to_customer: c.communicated_to_customer ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  })

  const updated = [...newEntries, ...current]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return newEntries
}

export function updateLocalComplaint(id: string, updates: Partial<Complaint>): Complaint | null {
  const current = getLocalComplaints()
  const idx = current.findIndex((c) => c.id === id)
  if (idx === -1) return null

  const updatedRecord = {
    ...current[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  }
  current[idx] = updatedRecord
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  return updatedRecord
}

export function getLocalHistory(complaintId: string): ComplaintHistory[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const all: ComplaintHistory[] = raw ? JSON.parse(raw) : []
    return all.filter((h) => h.complaint_id === complaintId)
  } catch {
    return []
  }
}

export function appendLocalHistory(entry: Omit<ComplaintHistory, 'id' | 'created_at'>): ComplaintHistory {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const all: ComplaintHistory[] = raw ? JSON.parse(raw) : []
    const newEntry: ComplaintHistory = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
    }
    all.push(newEntry)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all))
    return newEntry
  } catch {
    return { ...entry, id: `hist-${Date.now()}`, created_at: new Date().toISOString() }
  }
}

export function saveLocalEscalation(esc: any) {
  try {
    const raw = localStorage.getItem(ESCALATIONS_KEY)
    const all: Record<string, any> = raw ? JSON.parse(raw) : {}
    all[esc.complaint_id] = { ...esc, id: `esc-${Date.now()}`, escalated_at: new Date().toISOString() }
    localStorage.setItem(ESCALATIONS_KEY, JSON.stringify(all))
  } catch {}
}

export function getLocalEscalation(complaintId: string): Escalation | null {
  try {
    const raw = localStorage.getItem(ESCALATIONS_KEY)
    const all = raw ? JSON.parse(raw) : {}
    return all[complaintId] || null
  } catch {
    return null
  }
}

export function saveLocalInvestigation(inv: any): FIInvestigation {
  try {
    const raw = localStorage.getItem(INVESTIGATIONS_KEY)
    const all: Record<string, any> = raw ? JSON.parse(raw) : {}
    const entry = {
      ...inv,
      id: all[inv.complaint_id]?.id || `inv-${Date.now()}`,
      updated_at: new Date().toISOString(),
      submitted_at: all[inv.complaint_id]?.submitted_at || new Date().toISOString(),
    }
    all[inv.complaint_id] = entry
    localStorage.setItem(INVESTIGATIONS_KEY, JSON.stringify(all))
    return entry
  } catch {
    return inv
  }
}

export function getLocalInvestigation(complaintId: string): FIInvestigation | null {
  try {
    const raw = localStorage.getItem(INVESTIGATIONS_KEY)
    const all = raw ? JSON.parse(raw) : {}
    return all[complaintId] || null
  } catch {
    return null
  }
}
