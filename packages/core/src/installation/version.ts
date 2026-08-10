declare global {
  const KLAUTCODE_VERSION: string
  const KLAUTCODE_CHANNEL: string
}

export const InstallationVersion = typeof KLAUTCODE_VERSION === "string" ? KLAUTCODE_VERSION : "local"
export const InstallationChannel = typeof KLAUTCODE_CHANNEL === "string" ? KLAUTCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
