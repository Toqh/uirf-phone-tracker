export function onlineError() {
  return typeof navigator !== "undefined" && !navigator.onLine
    ? "You are offline. Connect to the internet before changing records."
    : null;
}

export function friendlyError(error: unknown) {
  const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : "The action could not be completed. Check your connection and try again.";
  return message.replace(/^.*?(permission denied|not authorised|not approved|already issued|not available|not configured|already returned)/i, "$1");
}
