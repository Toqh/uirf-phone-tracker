import type { PhoneRow } from "./types";

export function canIssue(phone: PhoneRow) {
  return phone.status === "available" && Boolean(phone.configured_at) && !phone.active_checkout_id;
}

export function resolveSerials(phones: PhoneRow[], input: string) {
  const serials = [...new Set(input.split(/[\s,;]+/).map((value) => value.trim().toUpperCase()).filter(Boolean))];
  const ids: string[] = []; const errors: string[] = [];
  for (const serial of serials) {
    const phone = phones.find((item) => item.serial_number.toUpperCase() === serial);
    if (!phone) errors.push(`${serial}: not found`);
    else if (!canIssue(phone)) errors.push(`${serial}: not available and ready to issue`);
    else ids.push(phone.id);
  }
  return { ids, errors };
}
