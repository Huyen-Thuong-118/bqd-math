export function hasCurrentCredentialVersion(
  sessionVersion: number | undefined,
  accountVersion: number,
) {
  return sessionVersion === accountVersion;
}
