export function greetingName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "there";
}

export function dashboardGreeting(date: Date, random: number) {
  // One in five page renders uses a welcome instead of the time-based greeting.
  if (random < 0.2) return "Welcome";
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos", hour: "2-digit", hourCycle: "h23",
  }).format(date));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
