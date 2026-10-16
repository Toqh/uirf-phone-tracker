"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PhoneRegister } from "./phone-register";
import { RegisterPhoneDialog } from "./register-phone-dialog";
import type { Enumerator, PhoneRow, Supervisor } from "@/lib/types";
import { phoneFiltersHref, readPhoneFilters, type PhoneFilters } from "@/lib/phone-filters";

export function PhoneRegisterPage(props: { phones: PhoneRow[]; enumerators: Enumerator[]; supervisors: Supervisor[]; isAdmin: boolean }) {
  const searchParams = useSearchParams();
  const filters = readPhoneFilters(searchParams);
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  function changeFilters(next: PhoneFilters) {
    window.history.replaceState(null, "", phoneFiltersHref(next, window.location.search));
  }
  function closeRegistration() {
    setOpen(false);
    if (searchParams.get("new") === "1") {
      const params = new URLSearchParams(window.location.search);
      params.delete("new");
      window.history.replaceState(null, "", phoneFiltersHref(filters, params.toString()));
    }
  }
  return <>
    <header className="page-header"><div><h1>Phone register</h1><p>Readiness, current custody, and complete movement history.</p></div>{props.isAdmin && <button className="button primary" onClick={() => setOpen(true)}>Add phone</button>}</header>
    <PhoneRegister {...props} filters={filters} onFiltersChange={changeFilters} />
    {props.isAdmin && open && <RegisterPhoneDialog onClose={closeRegistration} />}
  </>;
}
