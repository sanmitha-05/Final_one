// ============================================================
// Database type definitions — mirrors the Supabase schema
// ============================================================

export type UserRole = 'cce' | 'field_intelligence' | 'admin'

export type ComplaintStatus =
  | 'pending'
  | 'escalated'
  | 'in_progress'
  | 'resolved'
  | 'not_resolved'
  | 'reopened'

export type EscalationReason =
  | 'technical_support_required'
  | 'need_further_investigation'
  | 'others'

export type ActionTaken =
  | 'software_update'
  | 'component_replacement'
  | 'repair_adjustment'
  | 'inspection_diagnosis'
  | 'customer_guidance'
  | 'other'

export type RnDConsultation =
  | 'completed'
  | 'required'
  | 'technical_team'
  | 'none'
  | 'other'

export type ResolutionOutcome =
  | 'fix_implemented_verified'
  | 'recommended_fix_pending'
  | 'further_investigation_required'
  | 'unable_to_reproduce'
  | 'no_fix_identified'
  | 'other'

export type RootCauseConfidence = 'suspected' | 'confirmed'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Complaint {
  id: string
  incident_id: string
  date_of_report: string
  reported_by: string
  reported_by_name: string
  source: string | null
  customer_name: string | null
  customer_contact: string | null
  chassis_vin: string
  vehicle_model: string | null
  registration_number: string | null
  delivery_date: string | null
  incident_problem: string
  issue_summary: string | null
  detailed_description: string
  incident_date: string | null
  incident_location: string | null
  fault_code: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: ComplaintStatus
  is_escalated?: boolean
  communicated_to_customer?: boolean
  communicated_at?: string | null
  communicated_by?: string | null
  communicated_by_name?: string | null
  created_at: string
  updated_at: string
}

export interface Escalation {
  id: string
  complaint_id: string
  reason: EscalationReason
  additional_notes: string | null
  escalated_by: string
  escalated_by_name: string
  escalated_at: string
}

export interface CCEResolution {
  id: string
  complaint_id: string
  action_taken: ActionTaken
  action_details: string
  resolved_by: string
  resolved_by_name: string
  additional_notes: string | null
  submitted_at: string
}

export interface FIInvestigation {
  id: string
  complaint_id: string
  investigation_findings: string | null
  root_cause: string | null
  root_cause_confidence: RootCauseConfidence | null
  recommended_solution: string
  rnd_consultation: RnDConsultation
  consultation_details: string | null
  resolution_outcome: ResolutionOutcome
  additional_notes: string | null
  submitted_by: string
  submitted_by_name: string
  submitted_at: string
  updated_at: string
}

export interface ComplaintHistory {
  id: string
  complaint_id: string
  event_type: string
  previous_status: ComplaintStatus | null
  new_status: ComplaintStatus | null
  actor_id: string
  actor_name: string
  notes: string | null
  created_at: string
}

export interface Attachment {
  id: string
  complaint_id: string | null
  investigation_id: string | null
  storage_path: string
  original_filename: string
  mime_type: string
  file_size: number
  uploaded_by: string
  uploaded_by_name: string
  uploaded_at: string
}

export interface KnowledgeBaseRecord {
  id: string
  source_dataset: string
  source_file: string | null
  source_sheet: string | null
  source_row_id: string | null
  historical_ref_id: string | null
  fault_code: string | null
  issue_description: string | null
  vehicle_model: string | null
  component: string | null
  root_cause: string | null
  corrective_action: string | null
  investigation_outcome: string | null
  original_date: string | null
  import_batch: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface CustomerVehicle {
  id: string
  chassis_vin: string
  customer_name: string | null
  customer_contact: string | null
  vehicle_model: string | null
  registration_number: string | null
  delivery_date: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ProblemCategory {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

// ============================================================
// Database schema type (for Supabase client typing)
// ============================================================
export interface Database {
  public: {
    Tables: {
      customer_vehicles: {
        Row: CustomerVehicle
        Insert: Omit<CustomerVehicle, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CustomerVehicle, 'id' | 'created_at'>>
      }
      problem_categories: {
        Row: ProblemCategory
        Insert: Omit<ProblemCategory, 'id' | 'created_at'>
        Update: Partial<Omit<ProblemCategory, 'id' | 'created_at'>>
      }
      user_profiles: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserProfile, 'id' | 'created_at'>>
      }
      complaints: {
        Row: Complaint
        Insert: Omit<Complaint, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Complaint, 'id' | 'created_at'>>
      }
      escalations: {
        Row: Escalation
        Insert: Omit<Escalation, 'id'>
        Update: Partial<Omit<Escalation, 'id'>>
      }
      cce_resolutions: {
        Row: CCEResolution
        Insert: Omit<CCEResolution, 'id'>
        Update: Partial<Omit<CCEResolution, 'id'>>
      }
      fi_investigations: {
        Row: FIInvestigation
        Insert: Omit<FIInvestigation, 'id' | 'updated_at'>
        Update: Partial<Omit<FIInvestigation, 'id'>>
      }
      complaint_history: {
        Row: ComplaintHistory
        Insert: Omit<ComplaintHistory, 'id' | 'created_at'>
        Update: never
      }
      attachments: {
        Row: Attachment
        Insert: Omit<Attachment, 'id'>
        Update: never
      }
      knowledge_base: {
        Row: KnowledgeBaseRecord
        Insert: Omit<KnowledgeBaseRecord, 'id' | 'created_at'>
        Update: Partial<Omit<KnowledgeBaseRecord, 'id' | 'created_at'>>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      complaint_status: ComplaintStatus
      escalation_reason: EscalationReason
      action_taken: ActionTaken
      rnd_consultation: RnDConsultation
      resolution_outcome: ResolutionOutcome
      root_cause_confidence: RootCauseConfidence
    }
  }
}
