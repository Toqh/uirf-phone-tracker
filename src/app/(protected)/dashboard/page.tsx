import { AssignedPhones } from "@/components/assigned-phones";
import { dashboardPhones } from "@/lib/dashboard";
import { dashboardGreeting, greetingName } from "@/lib/greeting";
import { IssuePhonesActions } from "@/components/issue-phones";
import { PendingApprovals } from "@/components/pending-approvals";
import { requireProfile } from "@/lib/auth";
import type { Enumerator, PhoneRow, Profile, Supervisor } from "@/lib/types";

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile();
  const [phoneResult, enumeratorResult, supervisorResult, pendingResult] = await Promise.all([
    supabase.from("phone_register").select("*").order("serial_number"),
    supabase.from("enumerators").select("*").order("full_name"),
    supabase.from("supervisors").select("*").order("full_name"),
    profile.role === "admin" ? supabase.from("profiles").select("*", { count: "exact" }).eq("status", "pending").order("created_at").limit(20) : Promise.resolve(null)
  ]);
  const phones = (phoneResult.data || []) as PhoneRow[];
  const counts = { total: phones.length, awaiting: 0, available: 0, issued: 0, attention: 0 };
  phones.forEach((phone) => { if (phone.status === "awaiting_configuration") counts.awaiting++; else if (phone.status === "available") counts.available++; else if (phone.status === "issued") counts.issued++; else counts.attention++; });
  const assigned = dashboardPhones(profile, phones, (enumeratorResult.data || []) as Enumerator[], (supervisorResult.data || []) as Supervisor[]);
  const recordsError = phoneResult.error || enumeratorResult.error || supervisorResult.error;
  const now = new Date();
  // This async Server Component runs after request authentication, not during client rendering.
  // eslint-disable-next-line react-hooks/purity -- Choose a greeting once per server response; no client hydration randomness.
  const greeting = dashboardGreeting(now, Math.random());
  return <>
    <header className="page-header"><div><h1>{greeting}, {greetingName(profile.full_name)}</h1></div><div className="today-stamp">Nigeria time<br /><strong>{new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", dateStyle: "full" }).format(now)}</strong></div></header>

    {profile.role === "admin" && <section className="stats-grid" aria-label="Phone totals">
      <div className="stat-card total"><span>All registered phones</span><strong>{counts.total}</strong></div>
      <div className="stat-card awaiting"><span>Checklist due</span><strong>{counts.awaiting}</strong></div>
      <div className="stat-card available"><span>Ready to issue</span><strong>{counts.available}</strong></div>
      <div className="stat-card issued"><span>Pending return</span><strong>{counts.issued}</strong></div>
      <div className="stat-card attention"><span>Needs attention</span><strong>{counts.attention}</strong></div>
    </section>}
    {profile.role === "admin" && !phoneResult.error && !enumeratorResult.error && !supervisorResult.error && <IssuePhonesActions showRegistration phones={phones} enumerators={(enumeratorResult.data || []) as Enumerator[]} supervisors={(supervisorResult.data || []) as Supervisor[]} />}
    {profile.role === "admin" && pendingResult && <PendingApprovals accounts={(pendingResult.data || []) as Profile[]} total={pendingResult.count || 0} loadError={Boolean(pendingResult.error)} />}
    {recordsError ? <div className="notice error" role="alert">Phone records could not be loaded. Refresh the page to try again.</div> : profile.role !== "admin" && <AssignedPhones phones={assigned.phones} team={profile.role === "supervisor"} linked={assigned.linked} />}
  </>;
}
