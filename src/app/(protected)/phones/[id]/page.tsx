import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { formatLagos, statusLabel } from "@/lib/format";
import { CorrectionForm } from "@/components/correction-form";
import type { AuditEvent, Enumerator, MovementRow, PhoneRow, Supervisor } from "@/lib/types";

export default async function PhoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, profile } = await requireProfile();
  const [phoneResult, movementResult, eventResult, enumResult, supResult] = await Promise.all([
    supabase.from("phone_register").select("*").eq("id", id).maybeSingle(),
    supabase.from("movement_history").select("*").eq("phone_id", id).order("collected_at", { ascending: false }),
    supabase.from("audit_events").select("id,phone_id,event_type,occurred_at,details,profiles!audit_events_actor_id_fkey(full_name)").eq("phone_id", id).order("occurred_at", { ascending: false }),
    supabase.from("enumerators").select("*").order("full_name"), supabase.from("supervisors").select("*").order("full_name")
  ]);
  if (!phoneResult.data) notFound(); const phone = phoneResult.data as PhoneRow; const movements = (movementResult.data || []) as MovementRow[];
  const events = (eventResult.data || []).map((event: Record<string, unknown>) => ({ ...event, actor_name: (event.profiles as { full_name: string } | null)?.full_name || "Unknown" })) as AuditEvent[];
  return <><header className="page-header"><div><Link className="back-link" href="/phones">← Phone register</Link><h1>Phone <span className="detail-serial">{phone.serial_number}</span></h1><p><span className={`badge ${phone.status}`}>{statusLabel(phone.status)}</span></p></div></header>
    <div className="split"><section className="panel"><div className="panel-header"><h2>Movement history</h2></div><div className="table-wrap"><table><thead><tr><th>Enumerator</th><th>Supervisor</th><th>Collected</th><th>Returned</th><th>Issued by</th><th>Received by</th></tr></thead><tbody>{movements.map((row) => <tr key={row.id}><td>{row.enumerator_name}</td><td>{row.supervisor_name || "—"}</td><td>{formatLagos(row.collected_at)}</td><td>{formatLagos(row.returned_at)}</td><td>{row.issued_by_name}</td><td>{row.returned_by_name || "—"}</td></tr>)}</tbody></table>{!movements.length && <div className="empty">This phone has not been issued.</div>}</div>{profile.role === "admin" && movements.length > 0 && <CorrectionForm movements={movements} enumerators={(enumResult.data || []) as Enumerator[]} supervisors={(supResult.data || []) as Supervisor[]} />}</section>
      <aside className="panel"><div className="panel-header"><h2>Audit trail</h2></div><div className="panel-body timeline">{events.map((event) => <div className="timeline-item" key={event.id}><span className="timeline-dot" /><h3>{statusLabel(event.event_type.replace(".", " "))}</h3><p>{formatLagos(event.occurred_at)}<br />Recorded by {event.actor_name}</p>{typeof event.details?.reason === "string" && <p>Reason: {event.details.reason}</p>}</div>)}{!events.length && <div className="empty">No events recorded.</div>}</div></aside></div>
  </>;
}
