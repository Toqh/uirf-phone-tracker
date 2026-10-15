import type { Enumerator, PhoneRow, Profile, Supervisor } from "./types";

export function dashboardPhones(profile: Profile, phones: PhoneRow[], enumerators: Enumerator[], supervisors: Supervisor[]) {
  if (profile.role === "admin") return { linked: true, phones };
  const personal = enumerators.filter((item) => item.linked_profile_id === profile.id);
  const team = supervisors.filter((item) => item.linked_profile_id === profile.id);
  const personalIds = new Set(personal.map((item) => item.id));
  const teamIds = new Set(team.map((item) => item.id));
  const teamMembers = new Set(enumerators.filter((item) => item.usual_supervisor_id && teamIds.has(item.usual_supervisor_id)).map((item) => item.id));
  return {
    linked: profile.role === "enumerator" ? personal.length > 0 : team.length > 0,
    phones: phones.filter((phone) => phone.status === "issued" && Boolean(phone.active_checkout_id) && (
      profile.role === "enumerator" ? Boolean(phone.enumerator_id && personalIds.has(phone.enumerator_id))
        : Boolean((phone.supervisor_id && teamIds.has(phone.supervisor_id)) || (phone.enumerator_id && teamMembers.has(phone.enumerator_id)))
    )),
  };
}
