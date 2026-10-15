import Link from "next/link";
import { formatLagos } from "@/lib/format";
import type { PhoneRow } from "@/lib/types";

export function AssignedPhones({ phones, team, linked }: { phones: PhoneRow[]; team: boolean; linked: boolean }) {
  return <section className="panel"><div className="panel-header"><div><h2>{team ? "Your team’s phones" : "Phones with you"}</h2><span className="section-note">{phones.length} currently issued</span></div></div>
    {!linked ? <div className="empty">Your login account is not linked to a {team ? "supervisor" : "enumerator"} directory entry. Ask an Admin to link it in Directory.</div>
      : !phones.length ? <div className="empty">{team ? "No phones are currently issued to you or your team." : "No phones are currently issued to you."}</div>
        : <div className="table-wrap"><table><thead><tr><th>Phone</th>{team && <th>Holder</th>}<th>Project</th><th>Collected</th></tr></thead><tbody>{phones.map((phone) => <tr key={phone.id}><td><Link className="serial" href={`/phones/${phone.id}`}>{phone.serial_number}</Link></td>{team && <td>{phone.enumerator_name || phone.supervisor_name || "—"}</td>}<td>{phone.project || "—"}</td><td>{formatLagos(phone.collected_at)}</td></tr>)}</tbody></table></div>}
  </section>;
}
