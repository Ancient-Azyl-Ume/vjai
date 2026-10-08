# prototypes/audio-host - ticket 18

Throwaway prototype. Does the host (Rust + cpal) do the audio analysis instead of each WebView's
`getUserMedia`? Built and measured 2026-09-03 on a MacBook Pro (Apple silicon), macOS 26.

Not wired into the app. Nothing under `src/` or `src-tauri/` was touched.

## What it does

`src/main.rs` (516 lines), one binary:

- opens an input device by name substring (`--device`, default `Scarlett`), falls back to the
  default input and prints which device it opened
- ~60 Hz analysis loop: 2048-point real FFT (realfft), `rms`, `bass` 20-150 Hz, `mid` 150-2000 Hz,
  `high` 2000-12000 Hz, a bass-weighted spectral-flux onset with an adaptive threshold
  (mean + 1.6 sigma over the last ~1 s, 120 ms refractory) as `kick`
- BPM by autocorrelation of the full-band onset envelope over 8 s (lags 18..60 frames = 60..200 BPM),
  with a confidence and a free-running beat `phase` 0..1 that resyncs on a confident kick
- serves each frame as JSON over a WebSocket on `127.0.0.1:4821` (tungstenite, std threads,
  one thread per client, bounded queue so a slow client is dropped instead of stalling the analyser)
- prints a one-line terminal meter
- `--latency N` plays a 10 ms 120 Hz click through the default output every 1.5 s and times it to
  the analysis frame that fires the kick

`index.html` connects to the socket and draws the five signals plus the numbers.

```
cargo build --release
./target/release/audio-host --list
./target/release/audio-host --device Scarlett
python3 -m http.server 4830 --bind 127.0.0.1 -d .   # then open http://127.0.0.1:4830/index.html
```

## Numbers measured

Scarlett Solo was **not connected**. The fallback path was exercised and everything below is the
built-in `MacBook Pro Microphone` at 48 kHz, 1 ch, f32, listening to a 120 BPM click track played
through the laptop speakers.

| Measurement | Result |
|---|---|
| Analysis cost per frame | 101 us average, 178 us p95 (release build) |
| Duty cycle of the analysis loop | 0.60% of one core |
| Process CPU, no WS client (`ps %cpu`) | 0.7% of one core |
| Process CPU, 1 WS client | 1.4% |
| Process CPU, 3 WS clients | 2.3% |
| Marginal cost per client | ~0.55% of one core |
| RSS | 15-18 MB |
| JSON frame | ~250-400 bytes, 15-24 KB/s per client at 60 Hz |
| BPM lock on a 120 BPM click track | 120.0 exactly, confidence 1.00, locked after ~8 s (one envelope fill) |
| Kick detection | fired on every click, no false positives over a 12 s run |
| Mic permission prompt from a terminal | **no prompt**, audio captured immediately |

Extrapolated fan-out cost: 5 projector windows + phone + laptop = 7 clients ~ 4.5% of one core.

### Latency: not measured

The `--latency` mode is written and compiles, but the number is missing. Partway through the
session CoreAudio on this machine wedged (see below) and every attempt to open an input device
after that blocks forever, including `ffmpeg -f avfoundation`. The measurement needs a
`sudo killall coreaudiod` (or a reboot) first, then:

```
./target/release/audio-host --latency 12 --quiet
```

The components that make up the number, for reference: input hardware+buffer latency (the frames
carry it as `inputLatencyMs`), plus up to one 16.7 ms analysis hop, plus the age of the newest
sample in the ring (`bufferAgeMs`), plus the Tauri emit / WS hop. Expect roughly 20-40 ms from
sound at the mic to a signal frame in a window; the acoustic path in the latency test adds
~1-3 ms per metre.

## Two findings that matter more than the numbers

### 1. cpal's device enumeration can hang the whole machine's CoreAudio

`host.input_devices()` probes every device by opening an AudioUnit on it
(`supported_input_configs` -> `audio_unit_from_device` -> `AudioUnitSetProperty`). On this Mac
that call blocked forever inside `HALC_ProxyIOContext::_TellServerAboutStreamUsage` -> `mach_msg`
on the **NDI Audio** virtual device (an installed HAL plugin, `/Library/Audio/Plug-Ins/HAL/NDIAudio.driver`,
with no NDI process running). Confirmed with `sample` on the hung process, and reproduced with
`--probe`, which prints device names as it probes and stops on `NDI Audio`.

Worse: once one process is stuck there and gets SIGKILLed, **every later process** that opens
*any* input device blocks the same way, including the built-in mic and `ffmpeg -f avfoundation`.
`afplay` (AudioQueue) keeps working, so the machine looks fine. Only a coreaudiod restart clears it.

Consequences for vjai:

- never call `host.input_devices()` or `host.output_devices()`; enumerate `host.devices()` and read
  `name()` only, then touch configs on the single device you picked (this prototype does that)
- every CoreAudio call must sit on a worker thread with a timeout. The prototype opens the device on
  a thread and gives up after 3 s, then keeps running at 60 Hz with `audioOk: false` in every frame.
  That is exactly the "audio dead" status ticket 15 wants, and it is what let the HTML page be
  demoed while the machine's audio was broken.
- keep the Mini free of virtual audio drivers (NDI, rekordbox aggregates, loopback tools)

### 2. The microphone TCC grant does not belong to the binary when launched from a terminal

No prompt appeared and audio was captured on the first run. The reason is that the ad-hoc
(linker-signed) cargo binary has no TCC identity of its own: the *responsible process* is the
terminal's host app, which already holds the Microphone grant. Process ancestry here:
`audio-host` <- `zsh` <- `claude` <- `zsh` <- `login` <- `Zed.app`.

So "no prompt from the terminal" says nothing about the Mini. Under a LaunchAgent there is no
responsible parent app, the binary becomes the TCC subject itself, and an ad-hoc signature is
identified by CDHash, which changes on every rebuild. That matches the ops/watchdog research notes (not included in this repo).
A headless Mini cannot click a prompt that appears on a screen nobody is watching.

The launchd run in this session produced no output at all (job reached `state = running`, pid
assigned, empty stdout), which is consistent with the process blocking on the wedged CoreAudio
before its first `println!` reached the file. It is *not* evidence about TCC either way. The real
test has to be redone on a healthy machine, and on the Mini itself with the shipping signature.

## Embedding into src-tauri

### Crates

Add to `src-tauri/Cargo.toml`: `cpal = "0.15"` and `realfft = "3"` (pulls `rustfft`, `num-complex`,
`transpose`). Nothing else. `tungstenite` is prototype-only: inside Tauri the fan-out is the event
system, and the remote clients ride the doc WebSocket that ticket 04 already needs.

Build cost measured here: 23 s cold for the whole prototype, ~6 s incremental.

### Thread model

One `audio` module, one thread, no async.

1. `lib.rs` setup spawns the audio thread and puts an `Arc<Mutex<Signals>>` into Tauri state.
2. The audio thread picks the device by `doc.audio.deviceName` substring, builds the cpal input
   stream, and **keeps the `Stream` alive on that thread** (`cpal::Stream` is `!Send` on macOS,
   it cannot be moved to main). It parks after the loop starts.
3. The cpal input callback only downmixes to mono and pushes into a ring buffer. No FFT, no
   allocation, no lock beyond one uncontended `Mutex` (measured: no xruns at 60 Hz).
4. A second thread runs the 60 Hz analysis: reads the newest 2048 samples, FFT, bands, onset, BPM,
   writes the `Signals` struct into the shared `Mutex`, then `app.emit("audio:frame", &signals)`.
5. The main thread never makes a CoreAudio call. Device open and device change both happen on the
   audio thread behind a 3 s timeout; on timeout or error the analyser keeps emitting frames with
   `audioOk: false` and a reason string. The watchdog (ticket 10) reads that flag: a running app
   with dead audio is a failure state, not a healthy one.

### Fan-out to windows

`AppHandle::emit("audio:frame", signals)` serializes once and delivers to every webview, so the UI
window and all projector windows get the same frame; that is the point of the move, since today each
window analyses its own capture and they drift. Cost is comparable to what was measured here per
client (~0.5% of one core each), so 5 projectors stay under ~4%.

Frontend change is contained:

- `src/engine/audio/analyser.ts` keeps its `Signals` shape and `SIGNAL_NAMES`, but under Tauri it
  fills them from `listen("audio:frame")` instead of `getUserMedia`. `mods/modulator.ts` and the
  engine are untouched.
- keep the `getUserMedia` path as the browser fallback so `http://localhost:1420` still works,
  the same way `src/rpc.ts` already does for host calls.
- `BeatClock` stays in JS, free-running off the host's `bpm` and `phase`, so LFO sync and
  sample-and-hold keep working in silence.
- the host should also produce `snare` and `hat` (same onset class, different band and refractory)
  so the JS side loses nothing.

New host commands, appended to `generate_handler!` with browser fallbacks in `src/rpc.ts`:
`list_audio_devices` (names only, never `input_devices()`), `set_audio_device(name_substring)`,
`get_audio_signals` (pull, for the agent turn context so it does not have to wait for an event).

The Direktor loop and the phone UI read the same `Arc<Mutex<Signals>>`, so the agent and the
visuals are guaranteed to be looking at the same audio.

## Risks

1. **CoreAudio blocking calls.** Measured, not theoretical, and it survives process death. Every
   device call needs a timeout and an off-main-thread home, and the Mini must not carry virtual
   audio drivers. A wedged input on show night looks like a healthy app with a frozen visual.
2. **TCC on the Mini.** Ad-hoc signatures re-prompt after every rebuild, and nobody is there to
   click. Sign with a stable Apple Development identity and a fixed bundle ID, grant Microphone once
   over Screen Sharing, and verify with `codesign -d -r -` that the requirement is stable across
   builds. Deploys that change the signature must be treated as "audio permission may be gone".
3. **Confidence is not calibrated.** It reached 1.00 on a clean click track, which tells you nothing
   about real music. Before the Direktor gates on it (ticket 14), record real venue material and
   re-scale, or the "low confidence, do not switch program" rule will never fire.
4. **BPM range is hard-coded** to 60-200 BPM by the 18..60 lag window, and the estimate quantises to
   the frame grid (at 60 Hz the resolution near 128 BPM is about 2 BPM). Parabolic interpolation on
   the autocorrelation peak fixes the resolution; the octave error (64 vs 128) is not handled at all.
5. **Latency is unmeasured.** If it lands above ~50 ms the kick will visibly lag the room and the
   analysis hop or the input buffer size has to come down.
6. **Gain.** The prototype uses a fixed 12x scale on the band energies. A line feed from the
   Scarlett has a completely different level from a mic; the per-venue gain question is ticket 14
   and has to be a doc field, not a constant.

## Recommendation

Move the analysis to the host. Three reasons, in order of weight:

1. In server mode (tickets 04, 05) a browser on Tamas's laptop would analyse *the laptop's*
   microphone. That is not a tuning problem, it is a wrong-signal problem, and no amount of
   WebView work fixes it.
2. The Direktor loop needs the same signals the visuals see. With per-window analysis there is no
   single answer to "what is the bass doing right now".
3. Cost is negligible: 0.7% of one core plus ~0.55% per window, 15-18 MB. Removing 6 WebView
   AudioContexts probably nets out cheaper than the host analyser costs.

Ship it as one `audio` module with the thread model above, with the timeout and `audioOk` flag from
day one, and keep the JS `getUserMedia` path alive purely as the browser-dev fallback.

Before building it, two things have to be done on real hardware: rerun `--latency` on a machine with
working CoreAudio, and run the whole thing from a LaunchAgent on the Mini with the shipping
signature to see the TCC behaviour for real.

## State of this machine

CoreAudio is currently wedged (see finding 1): any process opening an audio input blocks forever.
`sudo killall coreaudiod` or a reboot clears it. Speaker volume was set to 55-60 during the click
test and restored to its original 38; input volume was left at its original 65.
