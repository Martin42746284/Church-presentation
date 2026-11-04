/**
 * Set while the settings console is recording a keyboard shortcut (phase 7).
 *
 * The capture runs on `window` in the capture phase, but the transport
 * shortcuts of the workspace are registered on `window` too: for an event
 * dispatched on `window` both listeners are in the target phase and run in
 * registration order, so the workspace would still advance the slide while a
 * binding is being recorded. This flag lets it step aside.
 */
let capturing = false;

export function setCapturing(value: boolean): void {
  capturing = value;
}

export function isCapturing(): boolean {
  return capturing;
}
