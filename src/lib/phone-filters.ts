import type { PhoneStatus } from "./types";

export const phoneCategories: Record<PhoneStatus | "all", string> = {
  all: "All registered phones",
  awaiting_configuration: "Checklist due",
  available: "Ready to issue",
  issued: "Pending return",
  needs_attention: "Needs attention",
};

export interface PhoneFilters {
  query: string;
  status: PhoneStatus | "all";
  person: string;
  from: string;
  to: string;
  exclude: boolean;
  readiness: "all" | "complete" | "incomplete";
}

export function readPhoneFilters(params: Pick<URLSearchParams, "get">): PhoneFilters {
  const status = params.get("status");
  const readiness = params.get("readiness");
  return {
    query: params.get("q") || "",
    status: status && Object.hasOwn(phoneCategories, status) ? status as PhoneFilters["status"] : "all",
    person: params.get("person") || "",
    from: params.get("from") || "",
    to: params.get("to") || "",
    exclude: params.get("exclude") === "1",
    readiness: readiness === "complete" || readiness === "incomplete" ? readiness : "all",
  };
}

export function phoneFiltersHref(filters: PhoneFilters, search = "") {
  const params = new URLSearchParams(search);
  const values = {
    q: filters.query, status: filters.status === "all" ? "" : filters.status,
    person: filters.person, from: filters.from, to: filters.to,
    exclude: filters.exclude ? "1" : "", readiness: filters.readiness === "all" ? "" : filters.readiness,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value); else params.delete(key);
  }
  return `/phones${params.size ? `?${params}` : ""}`;
}
