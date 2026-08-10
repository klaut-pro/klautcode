export * as PublicEventManifest from "./public-event-manifest"

import { Event } from "@klautcode/schema/event"
import { EventManifest } from "@klautcode/schema/event-manifest"

export const Definitions = EventManifest.ServerDefinitions
export const Latest = Event.latest(Definitions)
