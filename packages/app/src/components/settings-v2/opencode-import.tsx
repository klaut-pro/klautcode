import { Component, For, Show, createSignal, onMount } from "solid-js"
import { getFilename } from "@klautcode/core/util/path"
import { ButtonV2 } from "@klautcode/ui/v2/button-v2"
import { CheckboxV2 } from "@klautcode/ui/v2/checkbox-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitleGroup } from "@klautcode/ui/v2/dialog-v2"
import { useDialog } from "@klautcode/ui/context/dialog"
import { useLanguage } from "@/context/language"
import {
  usePlatform,
  type OpencodeImportProject,
  type OpencodeImportResult,
} from "@/context/platform"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"

const projectName = (project: OpencodeImportProject) =>
  project.name || (project.worktree ? getFilename(project.worktree) : "") || project.id

export function OpencodeImportPanel(props: {
  defaultDirectory?: string
  onImported?: (result: OpencodeImportResult) => void
}) {
  const language = useLanguage()
  const platform = usePlatform()
  const [directory, setDirectory] = createSignal<string>()
  const [projects, setProjects] = createSignal<OpencodeImportProject[]>([])
  const [selected, setSelected] = createSignal(new Set<string>())
  const [scanning, setScanning] = createSignal(true)
  const [scanError, setScanError] = createSignal<string | null>(null)
  const [importing, setImporting] = createSignal(false)
  const [importError, setImportError] = createSignal<string | null>(null)
  const [result, setResult] = createSignal<OpencodeImportResult | null>(null)

  const runScan = async (dir?: string) => {
    setScanning(true)
    setScanError(null)
    setResult(null)
    setImportError(null)
    try {
      const scan = await platform.opencodeImport!.scan(dir)
      setDirectory(scan.directory)
      setProjects(scan.projects)
      setSelected(new Set(scan.projects.map((item) => item.id)))
    } catch (error) {
      setScanError(error instanceof Error ? error.message : String(error))
    } finally {
      setScanning(false)
    }
  }

  onMount(() => {
    void runScan(props.defaultDirectory)
  })

  const chooseDirectory = async () => {
    if (platform.platform !== "desktop") return
    const picked = await platform.openDirectoryPickerDialog({
      title: language.t("settings.import.opencode.chooseFolderLabel"),
    })
    if (!picked) return
    const dir = Array.isArray(picked) ? picked[0] : picked
    if (dir) void runScan(dir)
  }

  const toggleProject = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onImport = async () => {
    const dir = directory()
    const ids = [...selected()]
    if (!dir || ids.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const res = await platform.opencodeImport!.run(dir, ids)
      setResult(res)
      props.onImported?.(res)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div class="flex flex-col gap-4">
      <SettingsListV2>
        <SettingsRowV2
          title={language.t("settings.import.opencode.chooseFolderLabel")}
          description={directory() ?? ""}
        >
          <ButtonV2 variant="outline" onClick={chooseDirectory}>
            {language.t("settings.import.opencode.chooseFolder")}
          </ButtonV2>
        </SettingsRowV2>
      </SettingsListV2>

      <Show when={scanning()}>
        <p class="text-12-regular text-text-weak">{language.t("settings.import.opencode.scanning")}</p>
      </Show>

      <Show when={!scanning() && scanError()}>
        <p class="text-12-regular text-text-danger-base">{language.t("settings.import.opencode.error")}</p>
      </Show>

      <Show when={!scanning() && !scanError() && projects().length === 0}>
        <p class="text-12-regular text-text-weak">
          {language.t("settings.import.opencode.empty", { directory: directory() ?? "" })}
        </p>
      </Show>

      <Show when={!scanning() && !scanError() && projects().length > 0}>
        <div class="flex flex-col gap-1.5">
          <h3 class="settings-v2-section-title">{language.t("settings.import.opencode.projects")}</h3>
          <div class="flex flex-col gap-1.5 bg-surface-base rounded-lg p-2">
            <For each={projects()}>
              {(project) => (
                <CheckboxV2
                  checked={selected().has(project.id)}
                  onChange={() => toggleProject(project.id)}
                  label={projectName(project)}
                  description={language.plural("settings.import.opencode.sessions", project.sessionCount)}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      <Show when={importError()}>
        <p class="text-12-regular text-text-danger-base">
          {language.t("settings.import.opencode.error.detail", { error: importError() ?? "" })}
        </p>
      </Show>

      <Show when={result()}>
        <p class="text-12-regular text-text-base">
          {language.t("settings.import.opencode.done.summary", {
            projects: result()!.projects,
            sessions: result()!.sessions,
          })}
        </p>
      </Show>

      <Show when={!result()}>
        <div class="flex justify-end">
          <ButtonV2
            variant="contrast"
            disabled={importing() || selected().size === 0}
            onClick={onImport}
          >
            {importing() ? language.t("settings.import.opencode.importing") : language.t("settings.import.opencode.importSelected")}
          </ButtonV2>
        </div>
      </Show>
    </div>
  )
}

export const SettingsOpencodeImportV2: Component<{ defaultDirectory?: string }> = (props) => {
  const language = useLanguage()
  return (
    <>
      <div class="settings-v2-tab-header">
        <h2 class="settings-v2-tab-title">{language.t("settings.import.opencode.title")}</h2>
      </div>
      <div class="settings-v2-tab-body">
        <div class="settings-v2-section">
          <SettingsListV2>
            <SettingsRowV2
              title={language.t("settings.import.opencode.title")}
              description={language.t("settings.import.opencode.description")}
            >
              <span class="sr-only">{language.t("settings.import.opencode.title")}</span>
            </SettingsRowV2>
          </SettingsListV2>
        </div>
        <OpencodeImportPanel defaultDirectory={props.defaultDirectory} />
      </div>
    </>
  )
}

export function OpencodeImportDialog(props: { directory?: string; onClose?: () => void }) {
  const language = useLanguage()
  const dialog = useDialog()
  const [done, setDone] = createSignal(false)
  const close = () => {
    dialog.close()
    props.onClose?.()
  }
  return (
    <Dialog size="large" class="w-[min(calc(100vw-40px),720px)] h-[min(calc(100vh-40px),560px)] overflow-hidden">
      <DialogHeader closeLabel={language.t("dialog.importOpencode.skip")}>
        <DialogTitleGroup
          title={language.t("dialog.importOpencode.title")}
          description={language.t("settings.import.opencode.description")}
        />
      </DialogHeader>
      <DialogBody class="overflow-y-auto">
        <OpencodeImportPanel defaultDirectory={props.directory} onImported={() => setDone(true)} />
      </DialogBody>
      <DialogFooter>
        <ButtonV2 variant="ghost" onClick={close}>
          {done() ? language.t("settings.import.opencode.close") : language.t("dialog.importOpencode.skip")}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
