import Link from "next/link";
import type { supervisorRoster } from "@/lib/dashboard";

export function SupervisorTeam({ members }: { members: ReturnType<typeof supervisorRoster> }) {
  return <section className="panel" aria-labelledby="supervisor-team-title">
    <div className="panel-header"><div><h2 id="supervisor-team-title">Your enumerators</h2><span className="section-note">{members.length} enumerators · {members.filter((member) => member.phones.length > 0).length} with phones pending return</span></div></div>
    {!members.length ? <div className="empty">No enumerators are assigned to you yet. An Admin can assign their usual supervisor in Directory.</div>
      : <div className="table-wrap"><table>
        <thead><tr><th>Enumerator</th><th>Code</th><th>Return status</th><th>Phones with enumerator</th></tr></thead>
        <tbody>{members.map(({ enumerator, phones }) => <tr key={enumerator.id}>
          <td>{enumerator.full_name}{!enumerator.active && <span className="section-note">Inactive</span>}</td>
          <td>{enumerator.enumerator_code}</td>
          <td>{phones.length ? <span className="readiness waiting">{phones.length} pending return</span> : <span className="readiness ready">No phones pending</span>}</td>
          <td>{phones.length ? phones.map((phone, index) => <span key={phone.id}>{index > 0 && ", "}<Link className="serial" href={`/phones/${phone.id}`}>{phone.serial_number}</Link></span>) : "—"}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
