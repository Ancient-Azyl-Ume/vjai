# prototypes/preview-stream

Throwaway measurement rig for ticket 19: how good is MJPEG over WebSocket as the phone
preview for the installation, and when would it stop being good enough.

Measured on this Mac (Apple silicon, macOS, Node v22.22.3, Chrome 151), 2026-09-03.
Everything ran on one machine over loopback, so these numbers are the pipeline's own
cost, not a WAN measurement. The WAN cases are simulated with an artificial send delay.

## Run it

```sh
npm install                 # ws only
./gen-frames.sh             # 10 s testsrc2 -> JPEG sequences at 320x180 and 640x360
node bench.mjs              # all six configs, headless, prints a TSV table
node server.mjs --w 320 --h 180 --fps 5 --port 8791   # then open http://localhost:8791
```

The page is phone-width (390 px), shows the frame, and prints fps, per-frame kB,
bandwidth, latency, jitter, worst gap and command-to-glass. `?s=1` picks another stream.

## Shape

- Frames come from pre-rendered ffmpeg JPEGs (`frames/<size>/`), looped. node-canvas is
  not installed here (`ERR_MODULE_NOT_FOUND`), so the synthetic path in `server.mjs` is
  written but untested; the ffmpeg path is what produced every number below.
- Wire format is one binary WS message per frame: `[4-byte BE header length][JSON header][JPEG]`.
  Header is `{ n, s, ts, cmd, w, h }`.
- **Latency**: the page computes `Date.now() - header.ts`. Same-machine assumption: the
  page clock and the server clock are literally the same clock, so this is a true one-way
  delay with no offset estimation. Across a real network this number needs an NTP-style
  offset or it is meaningless; use command-to-glass instead, which is a round trip and
  needs no clock agreement.
- **Command-to-glass**: the client sends `{t:"cmd", id}`, the server stamps `cmd` into
  every following frame header, the client measures until it sees its own id. This is the
  number that matches "does the phone feel responsive": it includes the uplink, the
  server's next-frame boundary, and the downlink.
- **Jitter** is the standard deviation of frame inter-arrival gaps.
- Server CPU is `process.cpuUsage()` deltas over wall clock, printed once a second.

## Numbers

20 s per config after a 3 s warmup, one headless client per stream.

| config | fps | kB/frame | kB/s | latency ms | jitter ms | worst gap ms | server CPU % | CPU max % | cmd-to-glass ms |
|---|---|---|---|---|---|---|---|---|---|
| 320x180 @5 | 4.96 | 8.1 | 40.6 | 0.9 | 1.2 | 206 | 0.6 | 4.5 | 102 |
| 320x180 @15 | 14.77 | 8.1 | 120.0 | 0.9 | 1.2 | 75 | 1.0 | 5.0 | 35 |
| 640x360 @10 | 9.83 | 17.3 | 171.3 | 1.0 | 1.2 | 105 | 0.9 | 4.9 | 46 |
| 320x180 @5, +80 ms | 4.96 | 8.1 | 40.7 | 82.6 | 1.4 | 205 | 0.8 | 5.2 | 161 |
| 320x180 @5, +200 ms | 4.95 | 8.1 | 40.5 | 202.6 | 0.9 | 204 | 0.6 | 4.2 | 305 |
| 320x180 @5, 3 streams | 4.96 | 8.1 | 121.9 (total) | 0.7 | 0.8 | 203 | 0.8 | 5.4 | 78 |

Cross-check in real Chrome on the same server, 320x180 @5: fps 4.96, 8.1 kB/frame,
40.6 kB/s, latency 1.2 ms, jitter 0.9 ms, command-to-glass 113 ms. With +200 ms:
latency 203.1 ms, jitter 0.9 ms, command-to-glass 230 to 298 ms over four clicks.
The headless harness and the browser agree, so the browser is not the bottleneck.

Reading the table:

- "worst gap" tracks the frame period (200 ms at 5 fps, 75 ms at 15 fps), not a stall.
  Nothing dropped a frame in any config.
- Artificial delay costs bandwidth nothing and CPU nothing. It moves latency 1:1 and
  command-to-glass by roughly 2x the one-way delay plus up to one frame period
  (80 ms: 102 -> 161; 200 ms: 102 -> 305).
- 3 concurrent streams cost 3x bandwidth and no measurable extra CPU. Jitter did not
  degrade. The first version of this rig broadcast every stream to every client, which
  inflated the numbers to 365 kB/s and 95 ms jitter; that was a bug in the harness, not
  a property of the transport. Per-stream subscription (`?s=<n>`) fixed it.
- Server CPU is 0.5 to 1.0 % of one core throughout, but this rig sends pre-encoded
  buffers, so it excludes encoding. See below.

### Encode cost (the part this rig does not pay)

Measured in Chrome, `canvas.toDataURL("image/jpeg", 0.6)`, 60 iterations, which is exactly
what `Engine.snapshot()` already does:

| size | toDataURL ms | data URL kB | raw JPEG kB |
|---|---|---|---|
| 320x180 | 0.91 | 15.5 | 11.6 |
| 640x360 | 1.68 | 21.6 | 16.2 |
| 1280x720 | 5.92 | 43.5 | 32.6 |

Base64 adds 33 %: 15.5 kB on the wire for an 11.6 kB image. The prototype sends raw bytes
in a binary WS message and pays none of that.

`canvas.toBlob` and `OffscreenCanvas.convertToBlob` could not be measured: their callbacks
and promises never settled inside the extension's evaluation context. They are the obvious
next thing to time on the real Mini, since they are the only way to get the encode off the
synchronous render path.

ffmpeg's own encode time was measured too (0.13 to 0.33 ms/frame) but the figure is
dominated by source generation and threading and is not usable; ignore it.

## Verdict

**MJPEG over WebSocket is enough for gig 0, comfortably.**

320x180 @5 costs 41 kB/s per viewer, 8.1 kB per frame and under 1 % of one core. Even
three simultaneous viewers is 122 kB/s, which is nothing over Tailscale, and mobile data
handles it without thinking. 640x360 @10 at 171 kB/s is still fine and is the right choice
when Tamas is deciding whether a mapping edge is right rather than just whether the show
is alive.

Responsiveness under simulated WAN:

- **+80 ms** (roughly Budapest to Budapest over mobile, or a nearby DERP relay): 161 ms
  command-to-glass. Feels immediate. A slider drag reads as direct manipulation.
- **+200 ms** (bad mobile, or a relayed Tailscale path through a far region): 305 ms
  command-to-glass. Still usable but no longer direct: you push a macro slider and see it
  land a beat later. Fine for "change the program, check it worked", wrong for beat-matched
  live control. At 5 fps the frame period alone adds up to 200 ms of that, so raising the
  preview to 10 or 15 fps buys back more perceived responsiveness than any codec change
  would.

Practical setting for the phone: **320x180 @5 as the default**, with a manual bump to
640x360 @10 while actively editing. Consider dropping to 2 fps or pausing entirely when
the phone page is backgrounded (`document.visibilityState`), since an unattended phone
sitting on a table would otherwise stream all night.

**WebRTC is not needed for gig 0.** It would start to be worth the complexity when:

1. The preview needs to be full motion at 1080p or anything close to it. MJPEG has no
   inter-frame compression, so cost scales linearly with resolution and fps: 1280x720 @15
   would be roughly 490 kB/s per viewer plus 5.9 ms of encode per frame. H.264/VP8 would
   cut that by an order of magnitude.
2. Audio has to come with the picture (monitoring what the room hears). MJPEG has no
   audio path at all; adding one means inventing sync.
3. Many viewers at once. Each MJPEG viewer is a full duplicate stream from the Mini's
   uplink. Three is free, ten at 640x360 @10 is 1.7 MB/s upstream from a club's internet.
4. The latency budget drops below ~150 ms end to end, for example if the phone ever
   becomes the primary live control surface rather than a supervision window.

None of those are gig 0. Gig 0 wants "is it alive, does it look right, did my change
land", and 41 kB/s answers all three.

## How this plugs into the Tauri host

The JPEG source already exists. `src/engine/core/engine.ts`:

- `Engine.snapshot(): Promise<string>` sets a one-shot `snapshotRequest` callback.
- In `frame()`, after each registered view is drawn and blitted, the **first** view in
  `this.views` resolves it with `v.canvas.toDataURL("image/jpeg", 0.6)`.
- The agent reaches it through `src/agent/tools.ts:75`, which races it against a 2 s timeout
  because it only resolves when a view is actually registered.

Three consequences for a preview stream:

1. **Size is not controlled.** The snapshot is whatever the first registered view's canvas
   happens to be, which in the UI is the preview panel: on a laptop that is often 1000 px
   or more wide, so 6 ms of encode and 40 kB per frame instead of 0.9 ms and 12 kB. A
   stream must register **its own view** at a fixed 320x180 (`useEngineCanvas`-style, an
   offscreen 2D canvas rather than a DOM one) instead of piggybacking on view zero.
2. **Encode is synchronous on the render thread.** 0.91 ms at 320x180 inside the rAF frame
   is 0.5 % of a 60 fps budget at 5 fps, which is free; at 15 fps it is 1.4 %; at 640x360
   @10 it is 1.7 %. All acceptable. 1280x720 @15 (5.9 ms x 15 = 89 ms/s) is not, and would
   need `toBlob`/`convertToBlob` or a worker.
3. **Base64 is wasted.** `toDataURL` gives a data URL; the host should hand raw bytes to
   the WS layer. Either add a blob-based sibling to `snapshot()` or strip the prefix and
   base64-decode in Rust. 33 % of the bandwidth is at stake, which at these sizes is small
   enough that it can wait.

Wiring, in the shape the map already assumes (the Mini serves the web UI and the doc over
its own HTTP/WebSocket, behind Tailscale):

- The host already needs an HTTP/WS server for the phone UI and the doc. The preview is one
  more message type on that same socket, or a second path on the same server. No new port,
  no new dependency, nothing to open on the router.
- A `preview_frame` push, throttled server-side to the requested fps, carrying the same
  `{ ts, n }` header this prototype uses so the phone can keep showing its own latency.
- The frames originate in the **main UI window's** engine, which is the one running the
  composite view. Output windows each have their own engine, so a per-output preview
  (useful for checking one projector) means asking that window for its own snapshot, which
  is a per-window command rather than a global one.
- Fps and size belong in the request, not the doc: they are per-viewer, not part of the show.
- Backpressure: if `ws.bufferedAmount` is above roughly two frames, skip the frame instead
  of queueing. At 41 kB/s this never triggered here, but a phone dropping onto EDGE would
  otherwise build an unbounded queue and show minutes-old video.

## Files

- `server.mjs` - HTTP + WS server, frame timers, artificial delay, per-second CPU/bandwidth line
- `client.html` - phone-width viewer with the stats table and the control-action button
- `bench.mjs` - spawns a server per config, headless WS clients, prints the table
- `gen-frames.sh` - ffmpeg JPEG sequences
- `frames/` - generated, 150 frames per size (1.5 MB and 2.9 MB)
