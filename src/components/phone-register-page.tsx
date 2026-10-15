"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PhoneRegister } from "./phone-register";
import { RegisterPhoneDialog } from "./register-phone-dialog";
import type { Enumerator, PhoneRow, Supervisor } from "@/lib/types";

export function PhoneRegisterPage(props: { phones: PhoneRow[]; enumerators: Enumerator[]; supervisors: Supervisor[]; isAdmin: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  function closeRegistration() {
    setOpen(false);
    if (searchParams.get("new") === "1") router.replace("/phones");
  }
  return <>
    <header className="page-header"><div><h1>Phone register</h1><p>Readiness, current custody, and complete movement history.</p></div>{props.isAdmin && <button className="button primary" onClick={() => setOpen(true)}>Add phone</button>}</header>
    <PhoneRegister {...props} />
    {props.isAdmin && open && <RegisterPhoneDialog onClose={closeRegistration} />}
  </>;
}
