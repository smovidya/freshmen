import { FeatureFlags } from "@vidyafreshmen/flags"
import { getFlagOverrides } from "./dev/flag-overrides"

// Dev-toolbar overrides are stored in localStorage (browser + dev build only,
// see lib/dev/flag-overrides.ts) and read once at module load. Toggling a
// flag in the toolbar reloads the page so this picks up the new value.
export const flags = new FeatureFlags({
  overrides: getFlagOverrides(),
})