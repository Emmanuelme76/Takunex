export function providerHomePath(status?: string | null): string {
  return status === "APPROVED" || status === "PENDING_VERIFICATION"
    ? "/provider/dashboard"
    : "/provider/onboarding";
}
