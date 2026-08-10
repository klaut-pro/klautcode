import { AgentV2 } from "@klautcode/core/agent"
import { AISDK } from "@klautcode/core/aisdk"
import { Catalog } from "@klautcode/core/catalog"
import { CommandV2 } from "@klautcode/core/command"
import { Credential } from "@klautcode/core/credential"
import { AppNodeBuilder } from "@klautcode/core/effect/app-node-builder"
import { LayerNodePlatform } from "@klautcode/core/effect/app-node-platform"
import { LayerNode } from "@klautcode/core/effect/layer-node"
import { EventV2 } from "@klautcode/core/event"
import { FileSystem } from "@klautcode/core/filesystem"
import { FSUtil } from "@klautcode/core/fs-util"
import { Integration } from "@klautcode/core/integration"
import { Location } from "@klautcode/core/location"
import { Npm } from "@klautcode/core/npm"
import { PluginV2 } from "@klautcode/core/plugin"
import { Reference } from "@klautcode/core/reference"
import { SkillV2 } from "@klautcode/core/skill"
import { Effect, Layer } from "effect"
import { tempLocationLayer } from "../fixture/location"

const npmLayer = Layer.succeed(
  Npm.Service,
  Npm.Service.of({
    add: () => Effect.succeed({ directory: "", entrypoint: undefined }),
    install: () => Effect.void,
    which: () => Effect.succeed(undefined),
  }),
)

export const PluginTestLayer = AppNodeBuilder.build(
  LayerNode.group([
    FileSystem.node,
    FSUtil.node,
    Location.node,
    Npm.node,
    Credential.node,
    EventV2.node,
    LayerNodePlatform.httpClient,
    PluginV2.node,
    AgentV2.node,
    AISDK.node,
    Catalog.node,
    CommandV2.node,
    Integration.node,
    Reference.node,
    SkillV2.node,
  ]),
  [
    [Location.node, tempLocationLayer],
    [Npm.node, npmLayer],
  ],
)
