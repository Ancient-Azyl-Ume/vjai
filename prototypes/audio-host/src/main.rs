// Host-side audio analysis prototype (ticket 18).
// cpal input -> 2048-point FFT at ~60 Hz -> rms/bass/mid/high/kick/bpm -> WebSocket JSON on 127.0.0.1:4821.
//
// Usage:
//   cargo run --release -- [--device Scarlett] [--seconds 30] [--latency 10] [--list] [--quiet]

use std::collections::VecDeque;
use std::io::Write;
use std::net::TcpListener;
use std::sync::mpsc::{sync_channel, SyncSender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use realfft::RealFftPlanner;

const FFT: usize = 2048;
const RATE_HZ: f64 = 60.0;
const ENV_SECS: f64 = 8.0;
const PORT: u16 = 4821;

// ---------------------------------------------------------------- input ring

struct Ring {
    buf: Vec<f32>,
    w: usize,
    total: u64,
}

impl Ring {
    fn new(n: usize) -> Self {
        Ring { buf: vec![0.0; n], w: 0, total: 0 }
    }
    fn push(&mut self, v: f32) {
        let n = self.buf.len();
        self.buf[self.w] = v;
        self.w = (self.w + 1) % n;
        self.total += 1;
    }
    // Newest `out.len()` samples, oldest first.
    fn latest(&self, out: &mut [f32]) {
        let n = self.buf.len();
        let mut i = (self.w + n - out.len()) % n;
        for s in out.iter_mut() {
            *s = self.buf[i];
            i = (i + 1) % n;
        }
    }
}

// ---------------------------------------------------------------- onset

struct Onset {
    hist: [f32; 64],
    i: usize,
    last: Instant,
    value: f32,
}

impl Onset {
    fn new() -> Self {
        Onset { hist: [0.0; 64], i: 0, last: Instant::now(), value: 0.0 }
    }
    // Adaptive threshold: mean + k*stddev over the last ~1 s, plus a refractory window.
    fn update(&mut self, flux: f32, k: f32, refractory: Duration, now: Instant) -> bool {
        let mean = self.hist.iter().sum::<f32>() / self.hist.len() as f32;
        let var = self.hist.iter().map(|v| (v - mean) * (v - mean)).sum::<f32>() / self.hist.len() as f32;
        let std = var.sqrt();
        self.hist[self.i] = flux;
        self.i = (self.i + 1) % self.hist.len();

        let fired = flux > mean + k * std && flux > 1e-4 && now.duration_since(self.last) > refractory;
        if fired {
            self.last = now;
            self.value = 1.0;
        } else {
            self.value *= 0.82;
        }
        fired
    }
}

// ---------------------------------------------------------------- bpm

// Autocorrelation of the onset envelope over ~8 s of 60 Hz frames.
// Lags 18..=60 frames cover 60..200 BPM.
fn estimate_bpm(env: &VecDeque<f32>) -> (f64, f64) {
    let n = env.len();
    if n < 240 {
        return (0.0, 0.0);
    }
    let v: Vec<f32> = env.iter().copied().collect();
    let mean = v.iter().sum::<f32>() / n as f32;
    let c: Vec<f32> = v.iter().map(|x| x - mean).collect();
    let energy: f32 = c.iter().map(|x| x * x).sum();
    if energy <= 1e-9 {
        return (0.0, 0.0);
    }

    let (lo, hi) = (18usize, 60usize);
    let mut ac = vec![0.0f32; hi + 1];
    for lag in lo..=hi {
        let mut s = 0.0f32;
        for i in lag..n {
            s += c[i] * c[i - lag];
        }
        ac[lag] = s / energy;
    }
    let mut best = lo;
    for lag in lo..=hi {
        if ac[lag] > ac[best] {
            best = lag;
        }
    }
    let mean_ac = ac[lo..=hi].iter().sum::<f32>() / (hi - lo + 1) as f32;
    let peak = ac[best];
    // Confidence: how far the peak stands above the average correlation in the band.
    let conf = ((peak - mean_ac) * 2.5).clamp(0.0, 1.0) as f64;
    let bpm = 60.0 * RATE_HZ / best as f64;
    (bpm, conf)
}

// ---------------------------------------------------------------- ws fan-out

fn start_ws(clients: Arc<Mutex<Vec<SyncSender<String>>>>) {
    let listener = match TcpListener::bind(("127.0.0.1", PORT)) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("ws bind failed: {e}");
            return;
        }
    };
    println!("ws listening on ws://127.0.0.1:{PORT}");
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let _ = stream.set_nodelay(true);
            let mut ws = match tungstenite::accept(stream) {
                Ok(w) => w,
                Err(_) => continue,
            };
            // Bounded queue: a slow client is dropped rather than allowed to stall the analyser.
            let (tx, rx) = sync_channel::<String>(8);
            clients.lock().unwrap().push(tx);
            std::thread::spawn(move || {
                while let Ok(msg) = rx.recv() {
                    if ws.send(tungstenite::Message::Text(msg)).is_err() {
                        break;
                    }
                }
            });
        }
    });
}

// ---------------------------------------------------------------- main

struct Args {
    device: String,
    seconds: Option<u64>,
    latency: usize,
    list: bool,
    probe: bool,
    quiet: bool,
}

fn parse_args() -> Args {
    let mut a = Args { device: "Scarlett".into(), seconds: None, latency: 0, list: false, probe: false, quiet: false };
    let v: Vec<String> = std::env::args().skip(1).collect();
    let mut i = 0;
    while i < v.len() {
        match v[i].as_str() {
            "--device" => { a.device = v[i + 1].clone(); i += 1; }
            "--seconds" => { a.seconds = v[i + 1].parse().ok(); i += 1; }
            "--latency" => { a.latency = v[i + 1].parse().unwrap_or(0); i += 1; }
            "--list" => a.list = true,
            "--probe" => { a.list = true; a.probe = true; }
            "--quiet" => a.quiet = true,
            _ => {}
        }
        i += 1;
    }
    a
}

fn main() {
    let args = parse_args();
    let host = cpal::default_host();

    // Never call host.input_devices(): cpal probes every device by opening an AudioUnit,
    // which blocks forever in mach_msg on a stale aggregate/virtual device (measured here).
    // Enumerate names only, and touch configs on the one device we picked.
    if args.list {
        for d in host.devices().unwrap() {
            println!("device: {}", d.name().unwrap_or_default());
        }
        println!("default input: {:?}", host.default_input_device().and_then(|d| d.name().ok()));
        println!("default output: {:?}", host.default_output_device().and_then(|d| d.name().ok()));
        // --probe: which device wedges cpal's own enumeration? Prints a name, then hangs on it.
        if !args.probe {
            return;
        }
        for d in host.devices().unwrap() {
            println!("probing supported_input_configs: {}", d.name().unwrap_or_default());
            let _ = std::io::stdout().flush();
            let _ = d.supported_input_configs();
        }
        println!("probe finished, all devices safe");
        return;
    }

    let ring = Arc::new(Mutex::new(Ring::new(FFT * 4)));
    let in_meta = Arc::new(Mutex::new((Instant::now(), 0.0f64))); // (last callback, hw latency ms)

    // Open the device on a worker thread. Every CoreAudio call that touches a device can block
    // forever (a wedged virtual HAL driver poisons the whole server), so the analyser must never
    // wait on it: after 3 s we carry on with no audio and say so in every frame.
    let (tx, rx) = std::sync::mpsc::channel::<Result<(f64, String), String>>();
    let want = args.device.clone();
    let r = ring.clone();
    let m = in_meta.clone();
    std::thread::spawn(move || {
        let host = cpal::default_host();
        let wanted = want.to_lowercase();
        let matched = host
            .devices()
            .ok()
            .and_then(|mut it| it.find(|d| d.name().map(|n| n.to_lowercase().contains(&wanted)).unwrap_or(false)));
        let fallback = matched.is_none();
        let device = match matched.or_else(|| host.default_input_device()) {
            Some(d) => d,
            None => {
                let _ = tx.send(Err("no input device".into()));
                return;
            }
        };
        let name = device.name().unwrap_or_default();
        let label = if fallback { format!("{name} (no match for \"{want}\", using default input)") } else { name };

        let cfg = match device.default_input_config() {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.send(Err(format!("no input config: {e}")));
                return;
            }
        };
        let sr = cfg.sample_rate().0 as f64;
        let channels = cfg.channels() as usize;
        let stream = device.build_input_stream(
            &cfg.config(),
            move |data: &[f32], info: &cpal::InputCallbackInfo| {
                let now = Instant::now();
                let ts = info.timestamp();
                let lat = ts.callback.duration_since(&ts.capture).map(|d| d.as_secs_f64() * 1000.0).unwrap_or(0.0);
                *m.lock().unwrap() = (now, lat);
                let mut ring = r.lock().unwrap();
                for f in data.chunks(channels) {
                    let s: f32 = f.iter().sum();
                    ring.push(s / channels as f32);
                }
            },
            |e| eprintln!("input stream error: {e}"),
            None,
        );
        let stream = match stream {
            Ok(s) => s,
            Err(e) => {
                let _ = tx.send(Err(format!("build stream: {e}")));
                return;
            }
        };
        if let Err(e) = stream.play() {
            let _ = tx.send(Err(format!("play: {e}")));
            return;
        }
        let _ = tx.send(Ok((sr, format!("{label}, {sr} Hz, {channels} ch"))));
        loop {
            std::thread::park(); // cpal::Stream is !Send: keep it alive here
        }
    });

    let (sr, name, audio_ok) = match rx.recv_timeout(Duration::from_secs(3)) {
        Ok(Ok((sr, label))) => (sr, label, true),
        Ok(Err(e)) => (48000.0, format!("NO AUDIO: {e}"), false),
        Err(_) => (48000.0, "NO AUDIO: device open timed out after 3 s".into(), false),
    };
    println!("input: {name}");

    // Optional click generator for the latency measurement.
    let click_at: Arc<Mutex<Option<Instant>>> = Arc::new(Mutex::new(None));
    let _out = if args.latency > 0 { Some(start_click(&host, click_at.clone())) } else { None };

    let clients: Arc<Mutex<Vec<SyncSender<String>>>> = Arc::new(Mutex::new(Vec::new()));
    start_ws(clients.clone());

    // ------------------------------------------------------------ analysis loop
    let mut planner = RealFftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(FFT);
    let mut win = vec![0.0f32; FFT];
    let mut spec = fft.make_output_vec();
    let hann: Vec<f32> = (0..FFT)
        .map(|i| 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / FFT as f32).cos())
        .collect();

    let bin = sr / FFT as f64;
    let band = |lo: f64, hi: f64| ((lo / bin).ceil() as usize, ((hi / bin).floor() as usize).min(FFT / 2));

    let (b0, b1) = band(20.0, 150.0);
    let (m0, m1) = band(150.0, 2000.0);
    let (h0, h1) = band(2000.0, 12000.0);

    let mut prev_mag = vec![0.0f32; FFT / 2 + 1];
    let mut kick_onset = Onset::new();
    let mut env: VecDeque<f32> = VecDeque::with_capacity((ENV_SECS * RATE_HZ) as usize);
    let mut bpm = 0.0f64;
    let mut conf = 0.0f64;
    let mut phase = 0.0f64;
    let mut lat_samples: Vec<f64> = Vec::new();
    let mut max_rms = 0.0f32;

    let start = Instant::now();
    let mut last = Instant::now();
    let mut frame_us: VecDeque<f64> = VecDeque::with_capacity(600);
    let mut n = 0u64;
    let period = Duration::from_secs_f64(1.0 / RATE_HZ);
    let mut next = Instant::now();

    loop {
        next += period;
        let sleep = next.saturating_duration_since(Instant::now());
        std::thread::sleep(sleep);
        let t0 = Instant::now();
        let dt = t0.duration_since(last).as_secs_f64();
        last = t0;

        ring.lock().unwrap().latest(&mut win);

        let rms_raw = (win.iter().map(|v| v * v).sum::<f32>() / FFT as f32).sqrt();
        let mut buf: Vec<f32> = win.iter().zip(&hann).map(|(v, w)| v * w).collect();
        fft.process(&mut buf, &mut spec).unwrap();
        let mag: Vec<f32> = spec.iter().map(|c| c.norm() * (2.0 / FFT as f32)).collect();

        let energy = |a: usize, b: usize| -> f32 {
            if b <= a { return 0.0; }
            (mag[a..b].iter().map(|v| v * v).sum::<f32>() / (b - a) as f32).sqrt()
        };
        // Fixed scaling to 0..1; a real build puts the gain in the doc.
        let scale = |v: f32| (v * 12.0).min(1.0);
        let bass = scale(energy(b0, b1));
        let mid = scale(energy(m0, m1));
        let high = scale(energy(h0, h1));
        let rms = (rms_raw * 4.0).min(1.0);
        max_rms = max_rms.max(rms_raw);

        // Spectral flux: bass-weighted for the kick, full band for the tempo envelope.
        let mut flux_bass = 0.0f32;
        let mut flux_all = 0.0f32;
        for i in 1..mag.len() {
            let d = (mag[i] - prev_mag[i]).max(0.0);
            flux_all += d;
            if i >= b0 && i < b1 {
                flux_bass += d;
            }
        }
        prev_mag.copy_from_slice(&mag);

        let fired = kick_onset.update(flux_bass, 1.6, Duration::from_millis(120), t0);
        let kick = kick_onset.value;

        if env.len() >= (ENV_SECS * RATE_HZ) as usize {
            env.pop_front();
        }
        env.push_back(flux_all);

        if n % 30 == 0 {
            let (b, c) = estimate_bpm(&env);
            if c > 0.0 {
                bpm = b;
                conf = c;
            }
        }
        if bpm > 0.0 {
            phase = (phase + dt * bpm / 60.0).fract();
            if fired && conf > 0.35 {
                phase = 0.0; // resync on a confident kick
            }
        }

        // Latency: a click was written to the output, this is the frame that saw it.
        if fired {
            let mut c = click_at.lock().unwrap();
            if let Some(t) = *c {
                let ms = t0.duration_since(t).as_secs_f64() * 1000.0;
                if ms < 400.0 {
                    lat_samples.push(ms);
                    println!("\nclick -> kick: {ms:.1} ms  (n={})", lat_samples.len());
                    *c = None;
                }
            }
        }

        let (cb_at, hw_lat) = *in_meta.lock().unwrap();
        let buffer_age = t0.duration_since(cb_at).as_secs_f64() * 1000.0;

        let frame = serde_json::json!({
            "t": start.elapsed().as_secs_f64(),
            "rms": rms, "bass": bass, "mid": mid, "high": high,
            "kick": kick, "bpm": bpm, "confidence": conf, "phase": phase,
            "device": name, "sr": sr, "audioOk": audio_ok,
            "inputLatencyMs": hw_lat, "bufferAgeMs": buffer_age,
        })
        .to_string();

        {
            let mut cs = clients.lock().unwrap();
            cs.retain(|c| c.try_send(frame.clone()).is_ok());
        }

        frame_us.push_back(t0.elapsed().as_secs_f64() * 1e6);
        if frame_us.len() > 600 {
            frame_us.pop_front();
        }

        if !args.quiet && n % 6 == 0 {
            let bar = |v: f32| {
                let k = (v * 12.0).round() as usize;
                format!("{}{}", "#".repeat(k.min(12)), " ".repeat(12 - k.min(12)))
            };
            let avg = frame_us.iter().sum::<f64>() / frame_us.len().max(1) as f64;
            print!(
                "\rrms[{}] bass[{}] mid[{}] high[{}] kick {:.2} bpm {:5.1} conf {:.2} ph {:.2} cpu {:.0}us",
                bar(rms), bar(bass), bar(mid), bar(high), kick, bpm, conf, phase, avg
            );
            let _ = std::io::stdout().flush();
        }

        n += 1;
        if args.latency > 0 && lat_samples.len() >= args.latency {
            break;
        }
        if let Some(s) = args.seconds {
            if start.elapsed().as_secs() >= s {
                break;
            }
        }
    }

    println!();
    let avg = frame_us.iter().sum::<f64>() / frame_us.len().max(1) as f64;
    let mut sorted: Vec<f64> = frame_us.iter().copied().collect();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("max raw rms seen: {max_rms:.5} ({})", if max_rms > 1e-5 { "audio captured" } else { "SILENT: no mic permission or dead input" });
    println!(
        "frames {n}, analysis {:.0} us avg, {:.0} us p95, duty {:.2}% of one core",
        avg,
        sorted.get(sorted.len() * 95 / 100).copied().unwrap_or(0.0),
        avg * RATE_HZ / 1e4
    );
    if !lat_samples.is_empty() {
        lat_samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let med = lat_samples[lat_samples.len() / 2];
        println!(
            "click -> kick latency: n={} min {:.1} ms, median {:.1} ms, max {:.1} ms",
            lat_samples.len(),
            lat_samples[0],
            med,
            lat_samples[lat_samples.len() - 1]
        );
    }
}

// ---------------------------------------------------------------- click generator

// Emits a 10 ms 120 Hz burst every 1.5 s and records the estimated instant the first
// sample hits the speaker (callback wall clock + the stream's own playback delay).
fn start_click(host: &cpal::Host, click_at: Arc<Mutex<Option<Instant>>>) -> cpal::Stream {
    let device = host.default_output_device().expect("no output device");
    println!("output device: {}", device.name().unwrap_or_default());
    let cfg = device.default_output_config().unwrap();
    let sr = cfg.sample_rate().0 as f32;
    let ch = cfg.channels() as usize;
    let burst = (sr * 0.010) as usize;
    let gap = (sr * 1.5) as usize;

    let mut pos = gap; // counts samples since the last burst start
    let stream = device
        .build_output_stream(
            &cfg.config(),
            move |data: &mut [f32], info: &cpal::OutputCallbackInfo| {
                let now = Instant::now();
                let ts = info.timestamp();
                let delay = ts.playback.duration_since(&ts.callback).unwrap_or(Duration::ZERO);
                for (i, f) in data.chunks_mut(ch).enumerate() {
                    if pos >= gap {
                        pos = 0;
                        let at = now + delay + Duration::from_secs_f32(i as f32 / sr);
                        *click_at.lock().unwrap() = Some(at);
                    }
                    let v = if pos < burst {
                        let env = 1.0 - pos as f32 / burst as f32;
                        0.9 * env * (2.0 * std::f32::consts::PI * 120.0 * pos as f32 / sr).sin()
                    } else {
                        0.0
                    };
                    for s in f.iter_mut() {
                        *s = v;
                    }
                    pos += 1;
                }
            },
            |e| eprintln!("output stream error: {e}"),
            None,
        )
        .expect("build output stream");
    stream.play().unwrap();
    stream
}
