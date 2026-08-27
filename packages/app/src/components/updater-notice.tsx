import { createEffect } from "solid-js"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { showToast } from "@/utils/toast"

// Surfaces the *automatic* update check failures (e.g. the startup check) as a
// clear in-app notice. Without this, an unreachable release channel or a
// release that has no build for the current platform silently lands in the
// updater state and is only ever visible from the manual "Check for updates"
// toast in settings.
//
// The manual path (updater-action) already toasts with the raw error message;
// this component classifies the failure instead:
// - "missing-artifacts": the latest release has no build for this platform yet
//   (its update metadata, e.g. latest-mac.yml, is absent from the assets).
// - "unreachable": the release channel could not be reached.
// - anything else: falls back to the raw error message.
export function UpdaterNotice() {
  const platform = usePlatform()
  const language = useLanguage()
  let lastMessage = ""
  createEffect(() => {
    const state = platform.updater?.state()
    if (state?.status !== "error" || state.message === lastMessage) return
    lastMessage = state.message
    const description =
      state.reason === "missing-artifacts"
        ? language.t("settings.updates.toast.missingArtifacts")
        : state.reason === "unreachable"
          ? language.t("desktop.updater.dialog.checkFailed.message")
          : state.message
    // Defer past the mount flush: this effect can run while the toaster's
    // store subscription is still being set up (solid-sonner subscribes in
    // onMount), so a synchronous toast would be added to the store but never
    // rendered. A microtask runs after all mount effects have flushed.
    queueMicrotask(() => {
      showToast({
        title: language.t("common.requestFailed"),
        description,
      })
    })
  })
  return null
}
