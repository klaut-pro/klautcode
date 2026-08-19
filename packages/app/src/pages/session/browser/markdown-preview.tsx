import { createMemo, createResource, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { marked } from "marked"
import { codeToHtml } from "shiki"
import markedShiki from "marked-shiki"
import { ButtonV2 } from "@klautcode/ui/v2/button-v2"
import { MenuV2 } from "@klautcode/ui/v2/menu-v2"
import { Icon as IconV2 } from "@klautcode/ui/v2/icon"
import { useFile } from "@/context/file"
import { useSDK } from "@/context/sdk"
import { useLanguage } from "@/context/language"
import { showToast } from "@/utils/toast"
import "./markdown-preview.css"

const markedWithShiki = marked.use(
  {
    renderer: {
      link({ href, title, text }) {
        const titleAttr = title ? ` title="${title}"` : ""
        return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
      },
    },
  },
  markedShiki({
    highlight(code, lang) {
      return codeToHtml(code, {
        lang: lang || "text",
        themes: {
          light: "github-light",
          dark: "github-dark",
        },
      })
    },
  }),
)

function isPlanPath(path: string) {
  return path.includes("/.klautcode/plans/") || path.startsWith(".klautcode/plans/")
}

export function MarkdownPreview(props: { path: string }) {
  const file = useFile()
  const sdk = useSDK()
  const params = useParams<{ id?: string }>()
  const language = useLanguage()
  const isPlan = createMemo(() => isPlanPath(props.path))

  const text = () => {
    const content = file.get(props.path)?.content
    if (!content) return ""
    return typeof content === "string" ? content : content.content
  }
  const [html] = createResource(
    () => text(),
    (markdown) => (markdown ? markedWithShiki.parse(markdown) : ""),
  )

  const execute = (mode: "build" | "general") => {
    const sessionID = params.id
    if (!sessionID) return
    const promptText =
      mode === "build"
        ? `The plan at ${props.path} has been approved. You can now edit files. Execute the plan.`
        : `Implement the plan at ${props.path} in parallel. Break the plan into independent units of work and dispatch each to a subagent using the task tool. Determine the number of subagents automatically based on the plan's scope, then coordinate the subagents and deliver the final result.`
    void sdk()
      .api.session.prompt({
        sessionID,
        agent: mode,
        text: promptText,
      })
      .catch((error: unknown) => {
        const description = error instanceof Error ? error.message : String(error)
        showToast({ variant: "error", title: language.t("common.requestFailed"), description })
      })
  }

  return (
    <div class="h-full min-h-0 flex flex-col bg-background-base">
      <Show when={isPlan()}>
        <div class="flex shrink-0 items-center gap-1.5 px-3 py-1.5 border-b border-border-weaker-base">
          <span class="min-w-0 flex-1 truncate text-12-medium text-text-strong">
            {language.t("browser.plan.title")}
          </span>
          <ButtonV2 variant="outline" size="small" onClick={() => execute("build")}>
            {language.t("browser.plan.implement")}
          </ButtonV2>
          <MenuV2 gutter={4} modal={false} placement="bottom-end">
            <MenuV2.Trigger as={ButtonV2} variant="ghost-muted" size="small" icon="chevron-down">
              <span class="sr-only">{language.t("browser.plan.more")}</span>
            </MenuV2.Trigger>
            <MenuV2.Portal>
              <MenuV2.Content>
                <MenuV2.Item onSelect={() => execute("general")}>
                  <span class="flex items-center gap-2">
                    <IconV2 name="monitor" size="small" />
                    {language.t("browser.plan.parallel")}
                  </span>
                </MenuV2.Item>
              </MenuV2.Content>
            </MenuV2.Portal>
          </MenuV2>
        </div>
      </Show>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <div data-slot="markdown" class="markdown-preview" innerHTML={html()} />
      </div>
    </div>
  )
}
