import { Show, createMemo, onCleanup, onMount } from "solid-js"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { readyUpdateVersion } from "@/components/update-available"
import { dismissToast, showToast } from "@/utils/toast"

export function UpdateAvailableToast() {
  const platform = usePlatform()
  const language = useLanguage()
  const version = createMemo(() => readyUpdateVersion(platform.updater?.state()))

  return (
    <Show when={version()}>
      {(ready) => (
        <ReadyUpdateNotice
          version={ready()}
          install={() => void platform.updater?.install()}
          notify={(title, description, onClick) => void platform.notify(title, description, onClick)}
          title={language.t("toast.update.title")}
          description={language.t("toast.update.description", { version: ready() })}
          installLabel={language.t("toast.update.action.installRestart")}
          laterLabel={language.t("toast.update.action.notYet")}
        />
      )}
    </Show>
  )
}

export function ReadyUpdateNotice(props: {
  version: string
  install: () => void
  notify?: (title: string, description: string, onClick: () => void) => void
  title: string
  description: string
  installLabel: string
  laterLabel: string
}) {
  let toastId: number | undefined

  onMount(() => {
    toastId = showToast({
      persistent: true,
      icon: "download",
      title: props.title,
      description: props.description,
      actions: [
        {
          label: props.installLabel,
          onClick: props.install,
        },
        {
          label: props.laterLabel,
          onClick: "dismiss",
        },
      ],
    })
    props.notify?.(props.title, props.description, props.install)
  })

  onCleanup(() => {
    if (toastId === undefined) return
    dismissToast(toastId)
  })

  return null
}
