import { createEffect, createMemo, createSignal, For, Index, onCleanup, onMount, Show, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import { useLanguage } from "@/context/language"
import { showToast } from "@/utils/toast"
import { TooltipV2 } from "@klautcode/ui/v2/tooltip-v2"
import { drawMarker, drawShape, MARKER_COLOR, type DesignStroke } from "./annotation-draw"
import { compositeDesignCapture, nextAncestor, pickElements } from "./capture"
import { useDesignMode } from "./controller"
import {
  DESIGN_TOOL_KEYBINDS,
  computeContainLayout,
  mapPoint,
  mapRect,
  normalizeRect,
  type DesignElementAnnotation,
  type DesignElementInfo,
  type DesignPoint,
  type DesignShape,
  type DesignTool,
} from "./types"
import "./design-mode.css"

const PALETTE = ["#0A84FF", "#FF3B30", "#FFD60A", "#30D158", "#BF5AF2", "#FF9F0A", "#FFFFFF", "#000000"]

const TOOL_ORDER: readonly { tool: DesignTool; key: string; icon: JSX.Element }[] = [
  { tool: "select", key: "v", icon: <ToolIcon path="M5 3.5L15.5 9.5L10.8 11.2L13 15.5L10.8 16.5L8.6 12.2L5 15.5Z" /> },
  { tool: "marker", key: "m", icon: <ToolIcon path="M4 10a6 6 0 1 1 8 5.5V18h-4v-2.5A6 6 0 0 1 4 10Z" /> },
  { tool: "circle", key: "c", icon: <ToolIcon path="M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z" /> },
  { tool: "rect", key: "r", icon: <ToolIcon path="M4 5.5h12v9H4z" /> },
  { tool: "arrow", key: "a", icon: <ToolIcon path="M3.5 15.5L14 5M14 5H7.5M14 5v6.5" /> },
  { tool: "freehand", key: "f", icon: <ToolIcon path="M4 15c1-6 4-9 7-7s4 4 6 0" /> },
  { tool: "text", key: "t", icon: <ToolIcon path="M7 4h6M10 4v12M6.5 16h7" /> },
]

export function DesignModeOverlay() {
  const design = useDesignMode()
  const language = useLanguage()
  const [tool, setTool] = createSignal<DesignTool>("select")
  const [color, setColor] = createSignal(MARKER_COLOR)
  const [width, setWidth] = createSignal(3)
  const [dim, setDim] = createSignal(true)
  const [shapes, setShapes] = createSignal<DesignShape[]>([])
  const [history, setHistory] = createSignal<DesignShape[][]>([])
  const [selection, setSelection] = createSignal<DesignElementAnnotation[]>([])
  const [hover, setHover] = createSignal<DesignElementInfo>()
  const [editingNote, setEditingNote] = createSignal<number>()
  const [draft, setDraft] = createSignal<DesignShape>()
  const [drawing, setDrawing] = createSignal<DesignPoint[]>()
  const [textAt, setTextAt] = createSignal<DesignPoint>()
  const [textContent, setTextContent] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  let canvas: HTMLCanvasElement | undefined
  const [host, setHost] = createSignal<HTMLElement | undefined>(
    typeof document === "undefined"
      ? undefined
      : (document.querySelector("[data-component=browser-webview]") as HTMLElement | undefined),
  )
  const [hostBox, setHostBox] = createSignal({ width: 0, height: 0 })

  const probe = createMemo(() => design.probe())
  const capture = createMemo(() => design.capture())
  const viewport = () => probe()?.viewport ?? { width: 0, height: 0 }
  const style = (): DesignStroke => ({ color: color(), width: width(), dim: dim() })
  const contain = createMemo(() => {
    const box = hostBox()
    const view = viewport()
    if (!host() || box.width <= 0 || box.height <= 0 || view.width <= 0 || view.height <= 0) {
      return { scale: 1, offsetX: 0, offsetY: 0 }
    }
    return computeContainLayout(view.width, view.height, box.width, box.height)
  })
  const stageStyle = (): JSX.CSSProperties => {
    const view = viewport()
    const layout = contain()
    return {
      left: `${layout.offsetX}px`,
      top: `${layout.offsetY}px`,
      width: `${view.width * layout.scale}px`,
      height: `${view.height * layout.scale}px`,
    }
  }

  createEffect(() => {
    if (!design.active()) {
      setHost(undefined)
      document.documentElement.removeAttribute("data-design-mode")
      return
    }
    document.documentElement.setAttribute("data-design-mode", "")
    const el = document.querySelector("[data-component=browser-webview]") as HTMLElement | null
    setHost(el ?? undefined)
    if (!el) {
      setHostBox({ width: 0, height: 0 })
      const watch = new MutationObserver(() => {
        if (!document.querySelector("[data-component=browser-webview]")) {
          console.info("[browser-tab]", "design-mode host gone, exiting")
          design.exit()
        }
      })
      watch.observe(document.body, { childList: true, subtree: true })
      onCleanup(() => watch.disconnect())
      return
    }
    const update = () => {
      const rect = el.getBoundingClientRect()
      setHostBox({ width: rect.width, height: rect.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener("resize", update)
    const watch = new MutationObserver(() => {
      if (!document.contains(el)) {
        console.info("[browser-tab]", "design-mode host unmounted, exiting")
        design.exit()
      }
    })
    watch.observe(document.body, { childList: true, subtree: true })
    onCleanup(() => {
      observer.disconnect()
      watch.disconnect()
      window.removeEventListener("resize", update)
    })
  })

  onCleanup(() => document.documentElement.removeAttribute("data-design-mode"))

  const commit = (next: DesignShape[]) => {
    setHistory((stack) => [...stack.slice(-50), shapes()])
    setShapes(next)
  }

  const undo = () => {
    const stack = history()
    if (stack.length === 0) return
    setShapes(stack[stack.length - 1])
    setHistory(stack.slice(0, -1))
  }

  const clearAll = () => {
    setHistory((stack) => [...stack, shapes()])
    setShapes([])
    setSelection([])
  }

  const toggleSelection = (info: DesignElementInfo) => {
    setSelection((current) => {
      const found = current.findIndex((item) => item.info.index === info.index)
      if (found >= 0) return current.filter((_, index) => index !== found)
      const next = [...current, { number: current.length + 1, info }]
      return next.map((item, index) => ({ ...item, number: index + 1 }))
    })
  }

  const selectedNote = (index: number) => selection().find((item) => item.info.index === index)?.note

  const updateNote = (index: number, note: string) => {
    setSelection((current) =>
      current.map((item) => (item.info.index === index ? { ...item, note: note || undefined } : item)),
    )
  }

  const commitNote = (index: number) => {
    updateNote(index, (selectedNote(index) ?? "").trim())
    setEditingNote(undefined)
  }

  const redraw = () => {
    const context = canvas?.getContext("2d")
    const currentProbe = probe()
    if (!context || !canvas || !currentProbe) return
    const { width: w, height: h, dpr } = currentProbe.viewport
    const layout = contain()
    canvas.width = Math.max(1, Math.round(w * dpr))
    canvas.height = Math.max(1, Math.round(h * dpr))
    canvas.style.width = `${w * layout.scale}px`
    canvas.style.height = `${h * layout.scale}px`
    canvas.style.left = `${layout.offsetX}px`
    canvas.style.top = `${layout.offsetY}px`
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, w, h)
    for (const shape of shapes()) drawShape(context, shape, style())
    for (const { number, info } of selection()) drawMarker(context, number, info.center)
    const currentHover = hover()
    if (currentHover && tool() === "select") drawHover(context, currentHover)
    const currentDraft = draft()
    if (currentDraft) drawShape(context, currentDraft, style())
  }

  createEffect(() => {
    void [shapes(), selection(), hover(), draft(), tool(), color(), width(), dim(), viewport(), contain()]
    redraw()
  })

  const pointFrom = (event: PointerEvent): DesignPoint => {
    const rect = canvas?.getBoundingClientRect()
    const view = viewport()
    const width = rect?.width || view.width || 1
    const height = rect?.height || view.height || 1
    return {
      x: ((event.clientX - (rect?.left ?? 0)) * view.width) / width,
      y: ((event.clientY - (rect?.top ?? 0)) * view.height) / height,
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (busy()) return
    const point = pointFrom(event)
    const elements = probe()?.elements ?? []
    if (tool() === "text") {
      setTextAt(point)
      setTextContent("")
      return
    }
    if (tool() === "select" || tool() === "marker") {
      const ancestor = event.altKey || event.metaKey
      const target = ancestor ? nextAncestor(elements, point, pickElements(elements, point, false)[0]?.index ?? -1) : pickElements(elements, point, false)[0]
      if (target) {
        if (tool() === "select") {
          const already = selection().some((item) => item.info.index === target.index)
          toggleSelection(target)
          setEditingNote(already ? undefined : target.index)
        } else {
          setSelection((current) => {
            if (current.some((item) => item.info.index === target.index)) return current
            const next = [...current, { number: current.length + 1, info: target }]
            return next.map((item, index) => ({ ...item, number: index + 1 }))
          })
        }
        return
      }
      if (tool() === "select") setSelection([])
      return
    }
    if (tool() === "freehand") {
      setDrawing([point])
      setDraft({ type: "freehand", points: [point] })
      return
    }
    if (tool() === "arrow") {
      setDraft({ type: "arrow", from: point, to: point })
      return
    }
    const currentTool = tool()
    if (currentTool === "rect" || currentTool === "circle") {
      setDraft({ type: currentTool, x: point.x, y: point.y, width: 0, height: 0 })
      return
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    const point = pointFrom(event)
    const currentDraft = draft()
    if (currentDraft) {
      if (currentDraft.type === "arrow") {
        setDraft({ ...currentDraft, to: point })
        return
      }
      if (currentDraft.type === "freehand") {
        const points = [...(drawing() ?? []), point]
        setDrawing(points)
        setDraft({ type: "freehand", points })
        return
      }
      if (currentDraft.type === "rect" || currentDraft.type === "circle") {
        const rect = normalizeRect({ x: currentDraft.x, y: currentDraft.y }, point)
        setDraft({ ...currentDraft, ...rect })
        return
      }
    }
    if (tool() === "select" || tool() === "marker") {
      const element = pickElements(probe()?.elements ?? [], point, false)[0]
      setHover(element)
    }
  }

  const onPointerUp = () => {
    const currentDraft = draft()
    if (currentDraft) {
      if (currentDraft.type === "freehand" && currentDraft.points.length > 1) commit([...shapes(), currentDraft])
      else if (currentDraft.type === "arrow" && (currentDraft.to.x !== currentDraft.from.x || currentDraft.to.y !== currentDraft.from.y)) {
        commit([...shapes(), currentDraft])
      } else if (currentDraft.type === "rect" || currentDraft.type === "circle") {
        if (currentDraft.width > 2 || currentDraft.height > 2) commit([...shapes(), currentDraft])
      }
    }
    setDraft(undefined)
    setDrawing(undefined)
  }

  const commitText = () => {
    const content = textContent().trim()
    const at = textAt()
    if (content && at) commit([...shapes(), { type: "text", x: at.x, y: at.y, content }])
    setTextAt(undefined)
    setTextContent("")
  }

  const addToChat = async () => {
    if (busy()) return false
    const currentCapture = capture()
    const currentProbe = probe()
    const attach = design.attach()
    if (!currentCapture || !currentProbe || !attach) return false
    if (selection().length === 0 && shapes().length === 0) {
      design.exit()
      return false
    }
    setBusy(true)
    try {
      const result = await compositeDesignCapture({
        capture: currentCapture,
        selection: selection(),
        shapes: shapes(),
        viewport: currentProbe.viewport,
        style: style(),
      })
      await attach(result.file)
      design.setPendingMetadata(result.metadata)
      design.exit()
      return true
    } catch (error) {
      setBusy(false)
      showToast({
        title: language.t("designMode.toast.error"),
        description: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  const hasContent = () => selection().length > 0 || shapes().length > 0

  onMount(() => {
    design.setFlushHandler(() => addToChat())
    const onKeyDown = (event: KeyboardEvent) => {
      if (busy()) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        if (event.key === "Escape" && textAt()) {
          setTextAt(undefined)
          event.preventDefault()
          return
        }
        if (event.key === "Enter" && textAt()) {
          commitText()
          event.preventDefault()
          return
        }
        if (event.key === "Escape" && !target.closest("[data-component=design-mode]")) {
          event.preventDefault()
          design.exit()
        }
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        if (draft()) {
          setDraft(undefined)
          setDrawing(undefined)
          return
        }
        design.exit()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        undo()
        return
      }
      if (event.key === "Enter") {
        event.preventDefault()
        void design.submit()
        return
      }
      if (event.key.toLowerCase() === "d") {
        setDim((value) => !value)
        return
      }
      const next = DESIGN_TOOL_KEYBINDS[event.key.toLowerCase()]
      if (next) {
        setTool(next)
        setDraft(undefined)
        setDrawing(undefined)
      }
    }
    const prevent = (event: Event) => {
      if (draft() || drawing()) event.preventDefault()
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("contextmenu", prevent)
    onCleanup(() => {
      design.setFlushHandler(undefined)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("contextmenu", prevent)
    })
  })

  return (
    <Portal mount={host() ?? document.body}>
      <Show when={design.active() && probe()}>
        <div
          data-component="design-mode"
          classList={{ "dm-contained": !!host() }}
          role="dialog"
          aria-label={language.t("designMode.title")}
        >
          <div class="dm-backdrop">
            <Show when={capture()}>
              <img
                class="dm-image"
                src={capture()!.dataUrl}
                width={Math.round(probe()!.viewport.width * (capture()!.width / probe()!.viewport.width))}
                height={Math.round(probe()!.viewport.height * (capture()!.height / probe()!.viewport.height))}
                style={stageStyle()}
                draggable={false}
              />
            </Show>
            <canvas
              ref={canvas}
              data-component="design-mode-canvas"
              class="dm-canvas"
              style={stageStyle()}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
            <Show when={hover() && (tool() === "select" || tool() === "marker") ? hover() : undefined}>
              {(item) => {
                const mapped = mapRect(item(), contain())
                return (
                  <div
                    class="dm-hover-label"
                    style={{
                      left: `${mapped.x + mapped.width / 2}px`,
                      top: `${Math.max(mapped.y, 8)}px`,
                    }}
                  >
                    {item().selector}
                  </div>
                )
              }}
            </Show>
            <Index each={selection()}>
              {(annotation) => {
                const info = annotation().info
                const mapped = mapRect(info, contain())
                const box = hostBox()
                const pos = annotationCardPosition(
                  { ...info, ...mapped, center: { x: mapped.x + mapped.width / 2, y: mapped.y + mapped.height / 2 } },
                  host() && box.width > 0 ? box : viewport(),
                )
                return (
                  <div
                    class="dm-annotation-card"
                    style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
                    data-testid="design-mode-annotation"
                  >
                    <div class="dm-annotation-head">
                      <span class="dm-annotation-number">{annotation().number}</span>
                      <span class="dm-annotation-selector">{info.selector}</span>
                      <button
                        type="button"
                        class="dm-annotation-remove"
                        aria-label={language.t("designMode.actions.remove")}
                        onClick={() => toggleSelection(info)}
                      >
                        <ToolIcon path="M5 5l10 10M15 5L5 15" />
                      </button>
                    </div>
                    <textarea
                      ref={(element) => {
                        if (element && editingNote() === info.index) element.focus()
                      }}
                      class="dm-annotation-note"
                      value={annotation().note ?? ""}
                      onInput={(event) => updateNote(info.index, event.currentTarget.value)}
                      onBlur={() => commitNote(info.index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault()
                          event.stopPropagation()
                          commitNote(info.index)
                          void design.submit()
                        } else if (event.key === "Escape") {
                          event.preventDefault()
                          setEditingNote(undefined)
                        }
                      }}
                      placeholder={language.t("designMode.notePlaceholder")}
                      data-testid="design-mode-note"
                    />
                  </div>
                )
              }}
            </Index>
            <Show when={textAt()}>
              <input
                class="dm-text-input"
                style={{
                  left: `${mapPoint(textAt()!, contain()).x}px`,
                  top: `${mapPoint(textAt()!, contain()).y}px`,
                }}
                value={textContent()}
                onInput={(event) => setTextContent(event.currentTarget.value)}
                onBlur={commitText}
                placeholder={language.t("designMode.textPlaceholder")}
                data-testid="design-mode-text"
              />
            </Show>
          </div>

          <div class="dm-toolbar">
            <For each={TOOL_ORDER}>
              {(item) => (
                <TooltipV2 placement="top" value={`${language.t(`designMode.tool.${item.tool}`)} (${item.key})`}>
                  <button
                    type="button"
                    class="dm-tool-button"
                    classList={{ "dm-active": tool() === item.tool }}
                    aria-label={`${language.t(`designMode.tool.${item.tool}`)} (${item.key})`}
                    aria-pressed={tool() === item.tool}
                    onClick={() => setTool(item.tool)}
                  >
                    {item.icon}
                  </button>
                </TooltipV2>
              )}
            </For>
            <div class="dm-divider" />
            <For each={PALETTE}>
              {(swatch) => (
                <button
                  type="button"
                  class="dm-swatch"
                  classList={{ "dm-active": color() === swatch }}
                  style={{ background: swatch }}
                  aria-label={swatch}
                  aria-pressed={color() === swatch}
                  onClick={() => setColor(swatch)}
                />
              )}
            </For>
            <input
              type="range"
              class="dm-width"
              min="1"
              max="12"
              step="1"
              value={width()}
              aria-label={language.t("designMode.width")}
              onInput={(event) => setWidth(Number(event.currentTarget.value))}
            />
            <TooltipV2 placement="top" value={`${language.t("designMode.dim")} (d)`}>
              <button type="button" class="dm-tool-button" classList={{ "dm-active": dim() }} aria-pressed={dim()} aria-label={language.t("designMode.dim")} onClick={() => setDim((value) => !value)}>
                <ToolIcon path="M10 5.5V2M10 18v-3.5M4.5 10H2M18 10h-2.5M6 6L4.2 4.2M15.8 15.8L14 14M14 6l1.8-1.8M4.2 15.8L6 14" />
              </button>
            </TooltipV2>
            <div class="dm-divider" />
            <TooltipV2 placement="top" value={`${language.t("designMode.actions.undo")} (${(navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl")}+Z)`}>
              <button type="button" class="dm-tool-button" aria-label={language.t("designMode.actions.undo")} disabled={history().length === 0} onClick={undo}>
                <ToolIcon path="M8 5L5 8l3 3M5.5 8H12a2.5 2.5 0 0 1 0 5" />
              </button>
            </TooltipV2>
            <TooltipV2 placement="top" value={language.t("designMode.actions.clear")}>
              <button type="button" class="dm-tool-button" aria-label={language.t("designMode.actions.clear")} disabled={!hasContent()} onClick={clearAll}>
                <ToolIcon path="M5 5l10 10M15 5L5 15" />
              </button>
            </TooltipV2>
            <div class="dm-divider" />
            <button
              type="button"
              class="dm-button dm-primary"
              disabled={!hasContent() || busy()}
              onClick={() => void addToChat()}
            >
              {busy() ? language.t("designMode.actions.busy") : language.t("designMode.actions.addToChat")}
            </button>
          </div>
        </div>
      </Show>
    </Portal>
  )
}

function annotationCardPosition(info: DesignElementInfo, viewport: { width: number; height: number }) {
  const CARD_WIDTH = 224
  const CARD_HEIGHT = 88
  const GAP = 8
  const TOP_SAFE = 56
  const BOTTOM_SAFE = 16
  const clampX = (value: number) => Math.max(GAP, Math.min(value, Math.max(GAP, viewport.width - CARD_WIDTH - GAP)))
  const clampY = (value: number) => Math.max(TOP_SAFE, Math.min(value, Math.max(TOP_SAFE, viewport.height - BOTTOM_SAFE - CARD_HEIGHT)))
  const preferredLeft = info.x + info.width + GAP
  const fitsRight = preferredLeft + CARD_WIDTH <= viewport.width - GAP
  const left = fitsRight ? preferredLeft : info.x - CARD_WIDTH - GAP
  const bottom = info.y + info.height
  const fitsBelow = bottom + CARD_HEIGHT + GAP <= viewport.height - BOTTOM_SAFE
  const top = fitsBelow ? info.y + info.height + GAP : Math.max(TOP_SAFE, info.y - CARD_HEIGHT - GAP)
  return { left: clampX(left), top: clampY(top) }
}

function drawHover(context: CanvasRenderingContext2D, info: DesignElementInfo) {
  context.save()
  context.setLineDash([5, 4])
  context.strokeStyle = MARKER_COLOR
  context.lineWidth = 2
  context.strokeRect(info.x, info.y, info.width, info.height)
  context.setLineDash([])
  context.beginPath()
  context.arc(info.center.x, info.center.y, 16, 0, Math.PI * 2)
  context.fillStyle = "rgba(10, 132, 255, 0.25)"
  context.fill()
  context.strokeStyle = MARKER_COLOR
  context.lineWidth = 2
  context.stroke()
  context.restore()
}

function ToolIcon(props: { path: string }) {
  return (
    <svg class="dm-tool-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={props.path} />
    </svg>
  )
}