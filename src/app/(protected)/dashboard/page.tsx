import { PhoneRegister } from "@/components/phone-register";
import { IssuePhonesActions } from "@/components/issue-phones";
import { requireProfile } from "@/lib/auth";
import type { Enumerator, PhoneRow, Supervisor } from "@/lib/types";

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile();
  const [phoneResult, enumeratorResult, supervisorResult] = await Promise.all([
    supabase.from("phone_register").select("*").order("serial_number"),
    supabase.from("enumerators").select("*").order("full_name"),
    supabase.from("supervisors").select("*").order("full_name")
  ]);
  const phones = (phoneResult.data || []) as PhoneRow[];
  const counts = { total: phones.length, awaiting: 0, available: 0, issued: 0, attention: 0 };
  phones.forEach((phone) => { if (phone.status === "awaiting_configuration") counts.awaiting++; else if (phone.status === "available") counts.available++; else if (phone.status === "issued") counts.issued++; else counts.attention++; });
  return <>
    <header className="page-header"><div><h1>Phones at a glance</h1><p>{counts.issued ? `${counts.issued} phone${counts.issued === 1 ? " is" : "s are"} still in the field.` : "Every issued phone has been returned."}</p></div><div className="today-stamp">Nigeria time<br /><strong>{new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", dateStyle: "full" }).format(new Date())}</strong></div></header>
    {profile.role === "admin" && !phoneResult.error && !enumeratorResult.error && !supervisorResult.error && <IssuePhonesActions phones={phones} enumerators={(enumeratorResult.data || []) as Enumerator[]} supervisors={(supervisorResult.data || []) as Supervisor[]} />}
    <section className="stats-grid" aria-label="Phone totals">
      <div className="stat-card total"><span>All registered phones</span><strong>{counts.total}</strong></div>
      <div className="stat-card awaiting"><span>Checklist due</span><strong>{counts.awaiting}</strong></div>
      <div className="stat-card available"><span>Ready to issue</span><strong>{counts.available}</strong></div>
      <div className="stat-card issued"><span>Pending return</span><strong>{counts.issued}</strong></div>
      <div className="stat-card attention"><span>Needs attention</span><strong>{counts.attention}</strong></div>
    </section>
    {phoneResult.error ? <div className="notice error">Records could not be loaded: {phoneResult.error.message}</div> : <PhoneRegister phones={phones} enumerators={(enumeratorResult.data || []) as Enumerator[]} supervisors={(supervisorResult.data || []) as Supervisor[]} isAdmin={profile.role === "admin"} compact />}
  </>;
}
