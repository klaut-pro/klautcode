import { For, Show, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@klautcode/ui/button"
import { DockTray } from "@klautcode/ui/dock-surface"
import { Icon } from "@klautcode/ui/icon"
import { IconButton } from "@klautcode/ui/icon-button"
import { ScrollView } from "@klautcode/ui/scroll-view"
import { Tag as TagV2 } from "@klautcode/ui/v2/badge-v2"
import { Icon as IconV2 } from "@klautcode/ui/v2/icon"
import { MenuV2 } from "@klautcode/ui/v2/menu-v2"
import { TooltipV2 } from "@klautcode/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { useModels } from "@/context/models"
import { ModelCostLabel } from "@/components/dialog-select-model"
import { matchesModelSearch } from "@/components/dialog-select-model-search"
import { isFreeModel } from "@/hooks/provider-catalog"

export type FollowupDockItem = {
  id: string
  text: string
  model?: { providerID: string; modelID: string }
  variant?: string
}

type ModelItem = ReturnType<ReturnType<typeof useModels>["list"]>[number]

function QueueItemModelMenu(props: {
  model?: { providerID: string; modelID: string }
  disabled?: boolean
  onSelect: (model: { providerID: string; modelID: string }) => void
}) {
  const language = useLanguage()
  const models = useModels()
  const [store, setStore] = createStore({ open: false, search: "" })
  let searchRef: HTMLInputElement | undefined

  const currentKey = createMemo(() => {
    const key = props.model
    return key ? `${key.providerID}:${key.modelID}` : undefined
  })

  const label = createMemo(() => {
    const key = props.model
    if (!key) return language.t("dialog.model.select.title")
    return models.find(key)?.name ?? key.modelID
  })

  const items = createMemo(() => {
    const query = store.search.trim()
    return models
      .list()
      .filter((item) => models.visible({ providerID: item.provider.id, modelID: item.id }))
      .filter((item) =>
        query ? matchesModelSearch(query, [item.name, item.id, item.provider.name]) : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  const groups = createMemo(() => {
    const byProvider = new Map<string, ModelItem[]>()
    for (const item of items()) {
      byProvider.set(item.provider.id, [...(byProvider.get(item.provider.id) ?? []), item])
    }
    return [...byProvider.entries()]
  })

  const open = (next: boolean) => {
    if (next) {
      setStore({ open: true, search: "" })
      setTimeout(() =>
        requestAnimationFrame(() => {
          searchRef?.focus()
        }),
      )
      return
    }
    setStore({ open: false, search: "" })
  }

  const select = (item: ModelItem) => {
    setStore({ open: false, search: "" })
    props.onSelect({ providerID: item.provider.id, modelID: item.id })
  }

  return (
    <MenuV2 open={store.open} modal={false} placement="top-end" gutter={6} onOpenChange={open}>
      <TooltipV2 placement="top" gutter={4} value={language.t("session.followupDock.changeModel")}>
        <MenuV2.Trigger
          as={Button}
          size="small"
          variant="ghost"
          class="shrink-0 max-w-32"
          disabled={props.disabled}
          aria-label={language.t("session.followupDock.changeModel")}
        >
          <span class="min-w-0 truncate">{label()}</span>
          <IconV2 name="chevron-down" size="small" class="shrink-0" />
        </MenuV2.Trigger>
      </TooltipV2>
      <MenuV2.Portal>
        <MenuV2.Content
          class="w-[284px] overflow-hidden rounded-md border-0 bg-v2-background-bg-layer-01 !p-0 shadow-[var(--v2-elevation-floating)] focus:outline-none"
          onPointerDownOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div class="flex h-7 items-center gap-2 rounded-sm pl-3 pr-2.5 text-v2-icon-icon-muted">
            <Icon name="magnifying-glass" size="small" class="shrink-0" />
            <input
              ref={(el) => (searchRef = el)}
              value={store.search}
              placeholder={language.t("dialog.model.search.placeholder")}
              class="h-7 min-w-0 flex-1 border-0 bg-transparent text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint"
              spellcheck={false}
              autocorrect="off"
              autocomplete="off"
              autocapitalize="off"
              onInput={(event) => setStore("search", event.currentTarget.value)}
            />
            <Show when={store.search.trim()}>
              <button
                type="button"
                class="flex size-5 items-center justify-center rounded-sm text-v2-icon-icon-muted hover:bg-v2-overlay-simple-overlay-hover"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => setStore("search", "")}
                aria-label={language.t("common.clear")}
              >
                <IconV2 name="close" size="small" />
              </button>
            </Show>
          </div>
          <div class="h-px bg-v2-border-border-muted" />
          <ScrollView class="max-h-[220px] min-h-0">
            <div class="flex flex-col p-0.5 pt-0">
              <Show
                when={items().length > 0}
                fallback={
                  <div class="flex h-12 items-center px-3 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-faint">
                    {language.t("dialog.model.empty")}
                  </div>
                }
              >
                <For each={groups()}>
                  {([, list]) => (
                    <MenuV2.Group>
                      <MenuV2.GroupLabel class="gap-2 px-3">
                        <span class="min-w-0 truncate">{list[0].provider.name}</span>
                      </MenuV2.GroupLabel>
                      <MenuV2.RadioGroup value={currentKey()}>
                        <For each={list}>
                          {(item) => (
                            <MenuV2.RadioItem
                              value={`${item.provider.id}:${item.id}`}
                              class="w-full"
                              onSelect={() => select(item)}
                            >
                              <span class="min-w-0 truncate leading-5">{item.name}</span>
                              <Show when={isFreeModel(item.provider.id, item.cost)}>
                                <TagV2 class="shrink-0">{language.t("model.tag.free")}</TagV2>
                              </Show>
                              <ModelCostLabel cost={item.cost} intl={language.intl()} />
                            </MenuV2.RadioItem>
                          )}
                        </For>
                      </MenuV2.RadioGroup>
                    </MenuV2.Group>
                  )}
                </For>
              </Show>
            </div>
          </ScrollView>
        </MenuV2.Content>
      </MenuV2.Portal>
    </MenuV2>
  )
}

export function SessionFollowupDock(props: {
  items: FollowupDockItem[]
  sending?: string
  onSend: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onModelChange: (id: string, model: { providerID: string; modelID: string }) => void
  onDelegateAll: () => void
  onDelegate: (id: string) => void
}) {
  const language = useLanguage()
  const [store, setStore] = createStore({
    collapsed: false,
  })

  const toggle = () => setStore("collapsed", (value) => !value)
  const total = createMemo(() => props.items.length)
  const label = createMemo(() => language.plural("session.followupDock.summary", total()))
  const preview = createMemo(() => props.items[0]?.text ?? "")

  return (
    <DockTray
      data-component="session-followup-dock"
      style={{
        "margin-bottom": "-0.875rem",
        "border-bottom-left-radius": 0,
        "border-bottom-right-radius": 0,
      }}
    >
      <div
        class="pl-3 pr-2 py-2 flex items-center gap-2"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          toggle()
        }}
      >
        <span class="shrink-0 text-13-medium text-text-strong cursor-default">{label()}</span>
        <Show when={store.collapsed && preview()}>
          <span class="min-w-0 flex-1 truncate text-13-regular text-text-base cursor-default">{preview()}</span>
        </Show>
        <div class="ml-auto shrink-0 flex items-center gap-1">
          <Button
            size="small"
            variant="ghost"
            class="shrink-0"
            disabled={!!props.sending || props.items.length === 0}
            onMouseDown={(event: MouseEvent) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event: MouseEvent) => {
              event.stopPropagation()
              props.onDelegateAll()
            }}
          >
            {language.t("session.followupDock.delegateAll")}
          </Button>
          <IconButton
            data-collapsed={store.collapsed ? "true" : "false"}
            icon="chevron-down"
            size="normal"
            variant="ghost"
            style={{ transform: `rotate(${store.collapsed ? 180 : 0}deg)` }}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.stopPropagation()
              toggle()
            }}
            aria-label={
              store.collapsed ? language.t("session.followupDock.expand") : language.t("session.followupDock.collapse")
            }
          />
        </div>
      </div>

      <Show when={store.collapsed}>
        <div class="h-5" aria-hidden="true" />
      </Show>

      <Show when={!store.collapsed}>
        <div class="px-3 pb-7 flex flex-col gap-1.5 max-h-42 overflow-y-auto no-scrollbar">
          <For each={props.items}>
            {(item) => (
              <div class="flex items-center gap-2 min-w-0 py-1">
                <span class="min-w-0 flex-1 truncate text-13-regular text-text-strong">{item.text}</span>
                <QueueItemModelMenu
                  model={item.model}
                  disabled={!!props.sending}
                  onSelect={(model) => props.onModelChange(item.id, model)}
                />
                <Button
                  size="small"
                  variant="ghost"
                  class="shrink-0"
                  disabled={!!props.sending}
                  onClick={() => props.onDelegate(item.id)}
                >
                  {language.t("session.followupDock.delegate")}
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  class="shrink-0"
                  disabled={!!props.sending}
                  onClick={() => props.onSend(item.id)}
                >
                  {language.t("session.followupDock.sendNow")}
                </Button>
                <Button
                  size="small"
                  variant="ghost"
                  class="shrink-0"
                  disabled={!!props.sending}
                  onClick={() => props.onEdit(item.id)}
                >
                  {language.t("session.followupDock.edit")}
                </Button>
                <IconButton
                  icon="trash"
                  size="small"
                  variant="ghost"
                  class="shrink-0"
                  disabled={!!props.sending}
                  onClick={() => props.onDelete(item.id)}
                  aria-label={language.t("session.followupDock.delete")}
                />
              </div>
            )}
          </For>
        </div>
      </Show>
    </DockTray>
  )
}
