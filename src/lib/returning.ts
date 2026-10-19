import type { PhoneRow } from "./types";
import { runBulk } from "./register";
import { callRpc } from "./supabase/rpc";

export function canReturn(phone: PhoneRow) {
  return phone.status === "issued" && Boolean(phone.active_checkout_id);
}

export function resolveReturnSerials(phones: PhoneRow[], input: string) {
  const serials = [...new Set(input.split(/[\s,;]+/).map((value) => value.trim().toUpperCase()).filter(Boolean))];
  const ids: string[] = []; const errors: string[] = [];
  for (const serial of serials) {
    const phone = phones.find((item) => item.serial_number.toUpperCase() === serial);
    if (!phone) errors.push(`${serial}: not found`);
    else if (!canReturn(phone)) errors.push(`${serial}: no issued phone with an active checkout`);
    else ids.push(phone.id);
  }
  return { ids, errors };
}

export async function returnPhoneBatch(phones: PhoneRow[], progress: (done: number) => void) {
  if (!phones.length || !phones.every(canReturn)) throw new Error("Select issued phones with active checkouts before returning.");
  return runBulk(phones, (phone) => callRpc("return_phone", {
    p_checkout_id: phone.active_checkout_id,
    p_faulty: false,
  }), progress);
}
