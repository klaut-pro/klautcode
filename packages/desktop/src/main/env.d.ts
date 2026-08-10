interface ImportMetaEnv {
  readonly KLAUTCODE_CHANNEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "virtual:klautcode-server" {
  export namespace Server {
    export const listen: typeof import("../../../klautcode/dist/types/src/node").Server.listen
    export type Listener = import("../../../klautcode/dist/types/src/node").Server.Listener
  }
  export namespace Config {
    export const get: typeof import("../../../klautcode/dist/types/src/node").Config.get
    export type Info = import("../../../klautcode/dist/types/src/node").Config.Info
  }
  export const bootstrap: typeof import("../../../klautcode/dist/types/src/node").bootstrap
}
