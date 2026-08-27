import { execFile, execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"

const execFileAsync = promisify(execFile)
const packageDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(packageDir, "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")
// The Electron 42 packaging update briefly installed Linux launchers/icons under
// "klautcode-desktop". Keep that hidden desktop entry around so existing GNOME/KDE
// pins still resolve after the canonical app id changes back to ai.klautcode.desktop.
const legacyDesktopEntry = path.join(packageDir, "resources", "linux", "klautcode-desktop.desktop")
const legacyDesktopEntryFpm = `${legacyDesktopEntry}=/usr/share/applications/klautcode-desktop.desktop`

const metainfoFpm = (appId: string) =>
  `${path.join(packageDir, "resources", `${appId}.metainfo.xml`)}=/usr/share/metainfo/${appId}.metainfo.xml`

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.KLAUTCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "prod"
})()

const APP_IDS = {
  dev: "ai.klautcode.desktop.dev",
  beta: "ai.klautcode.desktop.beta",
  prod: "ai.klautcode.desktop",
} as const

const getBase = (appId: string): Configuration => ({
  artifactName: "klautcode-desktop-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id. For prod, app id "ai.klautcode.desktop" becomes
  // "ai.klautcode.desktop.desktop".
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
  },
  files: ["out/**/*", "resources/**/*", "!resources/klautcode-cli*"],
  // Never package a renderer bundle that is older than the sources it should
  // contain — electron-builder packages out/** as-is. Run as a bun subprocess
  // (this config itself loads under node/jiti, which lacks import.meta.dir).
  beforePack: () => {
    const checkScript = path.join(packageDir, "scripts", "check-renderer-fresh.ts")
    try {
      execFileSync("bun", [checkScript], { cwd: packageDir, stdio: "inherit" })
    } catch (error) {
      throw new Error(
        "Refusing to package a stale renderer: the build output is missing or older than the sources. " +
          `Run \"bun run build\" (or \"bun run package\", which builds first) before packaging.`,
        { cause: error },
      )
    }
  },
  extraResources: [
    ...(channel === "dev"
      ? [
          {
            from: "resources/",
            to: "",
            filter: ["klautcode-cli*"],
          },
        ]
      : []),
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: true,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: true,
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
    window: { width: 540, height: 380 },
    iconSize: 128,
  },
  protocols: {
    name: "Klautcode",
    schemes: ["klautcode"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    executableName: appId,
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: "Klautcode Dev",
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "klautcode-dev", fpm: [metainfoFpm(appId)] },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName: "Klautcode Beta",
        protocols: { name: "Klautcode Beta", schemes: ["klautcode"] },
        publish: { provider: "github", owner: "klaut-pro", repo: "klautcode-beta", channel: "latest" },
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "klautcode-beta", fpm: [metainfoFpm(appId)] },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName: "Klautcode",
        protocols: { name: "Klautcode", schemes: ["klautcode"] },
        publish: { provider: "github", owner: "klaut-pro", repo: "klautcode", channel: "latest" },
        deb: { fpm: [metainfoFpm(appId), legacyDesktopEntryFpm] },
        rpm: { packageName: "klautcode", fpm: [metainfoFpm(appId), legacyDesktopEntryFpm] },
      }
    }
  }
}

export default getConfig()
