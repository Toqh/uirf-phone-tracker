export type Role = "admin" | "supervisor" | "enumerator";
export type Project = "DASH" | "NUTRINT";
export type AccountStatus = "pending" | "approved" | "disabled";
export type PhoneStatus = "awaiting_configuration" | "available" | "issued" | "needs_attention";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface Supervisor {
  id: string;
  supervisor_code: string;
  full_name: string;
  email: string | null;
  active: boolean;
  linked_profile_id: string | null;
}

export interface Enumerator {
  linked_profile_id?: string | null;
  id: string;
  enumerator_code: string;
  full_name: string;
  active: boolean;
  usual_supervisor_id: string | null;
}

export interface PhoneRow {
  project: Project | null;
  id: string;
  serial_number: string;
  status: PhoneStatus;
  configured_at: string | null;
  configured_by_name: string | null;
  survey_app_installed: boolean;
  correct_form_loaded: boolean;
  login_sync_tested: boolean;
  device_checked: boolean;
  active_checkout_id: string | null;
  enumerator_id: string | null;
  enumerator_name: string | null;
  supervisor_id: string | null;
  supervisor_name: string | null;
  collected_at: string | null;
  issued_by_name: string | null;
}

export interface MovementRow {
  project: Project | null;
  id: string;
  phone_id: string;
  serial_number: string;
  enumerator_name: string | null;
  supervisor_name: string | null;
  collected_at: string;
  returned_at: string | null;
  issued_by_name: string;
  returned_by_name: string | null;
  return_condition: "good" | "faulty" | null;
  fault_notes: string | null;
}

export interface AuditEvent {
  id: string;
  phone_id: string | null;
  event_type: string;
  occurred_at: string;
  actor_name: string;
  details: Record<string, unknown>;
}
