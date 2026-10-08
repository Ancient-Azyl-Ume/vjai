// Live, per-window state the media sources publish for the UI. Not part of the doc:
// each window decodes its own copy, so this is what *this* window is showing right now.
// The layers panel polls it for the transport readout and the thumbnails.

export type VideoStatus = { duration: number; time: number; ready: boolean; paused: boolean };

// keyed by layer id
export const VIDEO_STATUS = new Map<string, VideoStatus>();
export const MEDIA_ELEMENTS = new Map<string, HTMLVideoElement | HTMLImageElement>();
