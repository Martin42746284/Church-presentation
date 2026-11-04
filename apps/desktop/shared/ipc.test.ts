import { describe, expect, it } from "vitest";
import { IPC, IPC_EVENTS, IPC_EVENT_CHANNELS, IPC_INVOKE_CHANNELS } from "./ipc";

describe("IPC contract", () => {
  it("declares only unique channel names", () => {
    expect(new Set(IPC_INVOKE_CHANNELS).size).toBe(IPC_INVOKE_CHANNELS.length);
    expect(new Set(IPC_EVENT_CHANNELS).size).toBe(IPC_EVENT_CHANNELS.length);
  });

  it("keeps request and event channels disjoint", () => {
    const events = new Set(IPC_EVENT_CHANNELS);
    for (const channel of IPC_INVOKE_CHANNELS) {
      expect(events.has(channel)).toBe(false);
    }
  });

  it("uses namespaced channel names", () => {
    for (const channel of [...IPC_INVOKE_CHANNELS, ...IPC_EVENT_CHANNELS]) {
      expect(channel).toMatch(/^(displays|projection|backend|app|settings|event):/);
    }
  });
});
