import { createContext, useContext, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { usePlatform } from "@/context/platform"
import { captureViewport, probeElements } from "./capture"
import type { DesignCapture, DesignProbeResult } from "./types"
import { DesignModeOverlay } from "./overlay"

export type DesignModeAttach = (file: File) => Promise<void> | void

type DesignModeStore = {
  active: boolean
  capturing: boolean
  error?: string
  capture?: DesignCapture
  probe?: DesignProbeResult
  attach?: DesignModeAttach
  vision?: boolean
  pendingMetadata?: string
}

export type DesignModeContextValue = {
  active: () => boolean
  capturing: () => boolean
  error: () => string | undefined
  capture: () => DesignCapture | undefined
  probe: () => DesignProbeResult | undefined
  vision: () => boolean | undefined
  attach: () => DesignModeAttach | undefined
  enter: () => Promise<void>
  exit: () => void
  setAttachHandler: (attach: DesignModeAttach) => void
  setVision: (vision: boolean) => void
  setPendingMetadata: (metadata: string) => void
  consumeMetadata: () => string | undefined
}

const DesignModeContext = createContext<DesignModeContextValue>()

export function DesignModeProvider(props: ParentProps) {
  const platform = usePlatform()
  const [store, setStore] = createStore<DesignModeStore>({ active: false, capturing: false })

  const value: DesignModeContextValue = {
    active: () => store.active,
    capturing: () => store.capturing,
    error: () => store.error,
    capture: () => store.capture,
    probe: () => store.probe,
    vision: () => store.vision,
    attach: () => store.attach,
    enter: async () => {
      if (store.active || store.capturing) return
      setStore({ capturing: true, error: undefined })
      try {
        const probe = await probeElements(platform)
        const capture = await captureViewport(platform, probe.viewport)
        setStore({ probe, capture, capturing: false, active: true })
      } catch (error) {
        setStore({ capturing: false, error: errorMessage(error) })
      }
    },
    exit: () =>
      setStore({ active: false, capturing: false, error: undefined, capture: undefined, probe: undefined, pendingMetadata: undefined }),
    setAttachHandler: (attach) => setStore("attach", attach),
    setVision: (vision) => setStore("vision", vision),
    setPendingMetadata: (metadata) => setStore("pendingMetadata", metadata),
    consumeMetadata: () => {
      const metadata = store.pendingMetadata
      setStore("pendingMetadata", undefined)
      return metadata
    },
  }

  return (
    <DesignModeContext.Provider value={value}>
      {props.children}
      <DesignModeOverlay />
    </DesignModeContext.Provider>
  )
}

export const useDesignMode = () => {
  const value = useContext(DesignModeContext)
  if (!value) throw new Error("useDesignMode must be used within DesignModeProvider")
  return value
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}