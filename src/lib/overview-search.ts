import { formatLagos, statusLabel } from "./format";
import { phoneCategories } from "./phone-filters";
import type { Enumerator, PhoneRow, Profile, Supervisor } from "./types";

export type SearchAccount = Pick<Profile, "id" | "full_name" | "email" | "role" | "status">;

export interface OverviewSearchRecord {
  id: string;
  kind: "Phone" | "Enumerator" | "Supervisor" | "Account";
  title: string;
  subtitle: string;
  status: string;
  statusClass: string;
  details: { label: string; value: string }[];
  phones: { id: string; serial: string }[];
  href?: string;
  terms: string;
  exactTerms: string[];
}

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function buildOverviewSearchRecords({ phones, enumerators, supervisors, accounts = [], canViewRegister }: {
  phones: PhoneRow[]; enumerators: Enumerator[]; supervisors: Supervisor[];
  accounts?: SearchAccount[]; canViewRegister: boolean;
}): OverviewSearchRecord[] {
  const supervisorById = new Map(supervisors.map((person) => [person.id, person]));
  const enumeratorById = new Map(enumerators.map((person) => [person.id, person]));
  const held = phones.filter((phone) => phone.status === "issued" && phone.active_checkout_id);
  const records: OverviewSearchRecord[] = [];
  function add(record: Omit<OverviewSearchRecord, "terms" | "exactTerms">, exactTerms: string[], extra = "") {
    records.push({ ...record, exactTerms: exactTerms.map(normalize), terms: normalize([
      record.kind, record.title, record.subtitle, record.status,
      ...record.details.map((detail) => detail.value), ...record.phones.map((phone) => phone.serial), extra,
    ].join(" ")) });
  }
  for (const phone of phones) {
    const enumerator = phone.enumerator_id ? enumeratorById.get(phone.enumerator_id) : undefined;
    const supervisor = phone.supervisor_id ? supervisorById.get(phone.supervisor_id) : undefined;
    add({
      id: `phone-${phone.id}`, kind: "Phone", title: phone.serial_number, subtitle: phone.project || "No project assigned",
      status: phoneCategories[phone.status], statusClass: phone.status,
      details: [
        { label: "Current holder", value: phone.status === "issued" && phone.active_checkout_id ? phone.enumerator_name || phone.supervisor_name || "Not recorded" : "No current holder" },
        { label: "Supervisor", value: phone.supervisor_name || "None assigned" },
        { label: "Collected", value: formatLagos(phone.collected_at) },
        ...(canViewRegister ? [{ label: "Checklist", value: phone.configured_at ? "Complete" : "Incomplete" }] : []),
      ],
      phones: [], href: canViewRegister ? `/phones/${phone.id}` : undefined,
    }, [phone.serial_number], `${phone.status.replaceAll("_", " ")} ${enumerator?.enumerator_code || ""} ${supervisor?.supervisor_code || ""}`);
  }
  for (const person of enumerators) {
    const assigned = held.filter((phone) => phone.enumerator_id === person.id);
    add({
      id: `enumerator-${person.id}`, kind: "Enumerator", title: person.full_name, subtitle: person.enumerator_code,
      status: person.active ? "Active" : "Inactive", statusClass: person.active ? "approved" : "disabled",
      details: [
        { label: "Pending return", value: `${assigned.length} ${assigned.length === 1 ? "phone" : "phones"}` },
        { label: "Usual supervisor", value: supervisorById.get(person.usual_supervisor_id || "")?.full_name || "None assigned" },
      ],
      phones: assigned.map((phone) => ({ id: phone.id, serial: phone.serial_number })),
    }, [person.full_name, person.enumerator_code]);
  }
  for (const person of supervisors) {
    const team = enumerators.filter((item) => item.usual_supervisor_id === person.id);
    const teamIds = new Set(team.map((item) => item.id));
    const direct = held.filter((phone) => phone.supervisor_id === person.id && !phone.enumerator_id);
    const assigned = held.filter((phone) => phone.supervisor_id === person.id || (phone.enumerator_id && teamIds.has(phone.enumerator_id)));
    add({
      id: `supervisor-${person.id}`, kind: "Supervisor", title: person.full_name, subtitle: person.supervisor_code,
      status: person.active ? "Active" : "Inactive", statusClass: person.active ? "approved" : "disabled",
      details: [
        { label: "Personally held", value: `${direct.length} ${direct.length === 1 ? "phone" : "phones"}` },
        { label: "Team pending return", value: `${assigned.length} ${assigned.length === 1 ? "phone" : "phones"}` },
        { label: "Enumerators", value: String(team.length) },
        ...(person.email ? [{ label: "Email", value: person.email }] : []),
      ],
      phones: assigned.map((phone) => ({ id: phone.id, serial: phone.serial_number })),
    }, [person.full_name, person.supervisor_code, person.email || ""]);
  }
  for (const account of accounts) {
    add({
      id: `account-${account.id}`, kind: "Account", title: account.full_name, subtitle: account.email,
      status: statusLabel(account.status), statusClass: account.status,
      details: [{ label: "Role", value: statusLabel(account.role) }], phones: [], href: "/accounts",
    }, [account.full_name, account.email]);
  }
  return records;
}

export function searchOverview(records: OverviewSearchRecord[], query: string) {
  const search = normalize(query);
  if (!search) return [];
  const words = search.split(/\s+/);
  return records.filter((record) => words.every((word) => record.terms.includes(word)))
    .sort((a, b) => Number(b.exactTerms.includes(search)) - Number(a.exactTerms.includes(search)));
}
