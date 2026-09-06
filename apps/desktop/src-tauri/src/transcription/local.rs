use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Deserialize;
use tauri::{AppHandle, Emitter};

use crate::error::AppError;
use crate::recorder::session::{TranscriptSegment, TranscriptWord};
use crate::settings;
use crate::storage::app_data_dir;

#[derive(Debug, Deserialize)]
struct WhisperCliFile {
    #[serde(default)]
    transcription: Vec<WhisperCliLine>,
    result: Option<WhisperCliResult>,
}

#[derive(Debug, Deserialize)]
struct WhisperCliResult {
    language: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WhisperCliLine {
    timestamps: Option<WhisperCliStamps>,
    offsets: Option<WhisperCliOffsets>,
    text: Option<String>,
    #[serde(default)]
    tokens: Vec<WhisperCliToken>,
}

#[derive(Debug, Deserialize)]
struct WhisperCliToken {
    text: Option<String>,
    timestamps: Option<WhisperCliStamps>,
    offsets: Option<WhisperCliOffsets>,
    t0: Option<f64>,
    t1: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct WhisperCliStamps {
    from: Option<String>,
    to: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WhisperCliOffsets {
    from: Option<f64>,
    to: Option<f64>,
}

fn parse_stamp(value: &str) -> Option<u64> {
    let cleaned = value.trim().replace(',', ".");
    if cleaned.is_empty() {
        return None;
    }
    let parts: Vec<&str> = cleaned.split(':').collect();
    let seconds = match parts.as_slice() {
        [hours, minutes, secs] => {
            hours.parse::<f64>().ok()? * 3600.0 + minutes.parse::<f64>().ok()? * 60.0 + secs.parse::<f64>().ok()?
        }
        [minutes, secs] => minutes.parse::<f64>().ok()? * 60.0 + secs.parse::<f64>().ok()?,
        [secs] => secs.parse::<f64>().ok()?,
        _ => return None,
    };
    Some((seconds.max(0.0) * 1000.0).round() as u64)
}

fn offset_ms(value: f64) -> u64 {
    value.max(0.0).round() as u64
}

fn whisper_language_flag(language: &str) -> String {
    let trimmed = language.trim().to_ascii_lowercase();
    if trimmed.is_empty() || trimmed == "auto" {
        "auto".to_string()
    } else {
        trimmed
    }
}

pub fn runtime_available() -> bool {
    find_cli(None).is_some()
}

pub fn runtime_available_for(app: &AppHandle) -> bool {
    find_cli(Some(app)).is_some()
}

fn cli_name() -> &'static str {
    if cfg!(windows) {
        "whisper-cli.exe"
    } else {
        "whisper-cli"
    }
}

pub fn bundled_cli(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app_data_dir(app)?.join("bin");
    fs::create_dir_all(&dir)?;
    Ok(dir.join(cli_name()))
}

fn extra_bin_dirs() -> Vec<PathBuf> {
    [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/opt/homebrew/opt/whisper-cpp/bin",
        "/usr/local/opt/whisper-cpp/bin",
    ]
    .into_iter()
    .map(PathBuf::from)
    .collect()
}

fn find_in_dirs() -> Option<PathBuf> {
    let names = [cli_name(), "whisper-cli", "whisper"];
    let mut dirs = extra_bin_dirs();
    if let Ok(path) = std::env::var("PATH") {
        dirs.extend(std::env::split_paths(&path));
    }
    for dir in dirs {
        for name in names {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

fn find_cli(app: Option<&AppHandle>) -> Option<PathBuf> {
    if let Some(path) = find_in_dirs() {
        if let Some(app) = app {
            if let Ok(bundled) = bundled_cli(app) {
                if bundled != path {
                    let _ = fs::remove_file(bundled);
                }
            }
        }
        return Some(path);
    }
    let app = app?;
    let Ok(path) = bundled_cli(app) else {
        return None;
    };
    if path.is_file() {
        Some(path)
    } else {
        None
    }
}

struct SpeechWindow {
    offset_ms: u64,
    end_ms: u64,
    duration_ms: u64,
}

impl SpeechWindow {
    fn input_duration_ms(&self) -> u64 {
        self.end_ms.saturating_sub(self.offset_ms).max(1)
    }

    fn was_trimmed(&self) -> bool {
        self.offset_ms > 0 || self.end_ms + 200 < self.duration_ms
    }
}

fn detect_speech_window(path: &Path) -> Result<SpeechWindow, AppError> {
    let mut reader = hound::WavReader::open(path)?;
    let spec = reader.spec();
    let rate = u64::from(spec.sample_rate.max(1));
    let channels = usize::from(spec.channels.max(1));
    let samples: Vec<i16> = reader.samples::<i16>().collect::<Result<_, _>>()?;
    let frames_total = samples.len() as u64 / channels.max(1) as u64;
    let duration_ms = frames_total.saturating_mul(1000) / rate;
    let full = SpeechWindow {
        offset_ms: 0,
        end_ms: duration_ms,
        duration_ms,
    };
    if samples.is_empty() || duration_ms < 400 {
        return Ok(full);
    }

    const FRAME_MS: u64 = 20;
    const PAD_MS: u64 = 300;
    let frame_len = ((rate * FRAME_MS) / 1000).max(1) as usize * channels;
    let mut energies = Vec::new();
    for chunk in samples.chunks(frame_len) {
        let mean_sq = chunk.iter().map(|sample| {
            let value = f64::from(*sample);
            value * value
        }).sum::<f64>() / chunk.len().max(1) as f64;
        energies.push(mean_sq.sqrt());
    }
    if energies.is_empty() {
        return Ok(full);
    }

    let mut sorted = energies.clone();
    sorted.sort_by(|left, right| left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal));
    let noise = sorted.get(sorted.len() / 5).copied().unwrap_or(0.0);
    let peak = sorted.last().copied().unwrap_or(0.0);
    if peak < 250.0 || peak < noise * 1.8 {
        return Ok(full);
    }
    let threshold = (noise + (peak - noise) * 0.18).max(noise * 2.5);
    let needed = 5_usize;
    let mut first = None;
    let mut last = None;
    let mut run = 0_usize;
    for (index, energy) in energies.iter().enumerate() {
        if *energy >= threshold {
            run += 1;
            if run >= needed {
                if first.is_none() {
                    first = Some(index + 1 - needed);
                }
                last = Some(index);
            }
        } else {
            run = 0;
        }
    }
    let Some(start_index) = first else {
        return Ok(full);
    };
    let end_index = last.unwrap_or(start_index);
    let offset_ms = (start_index as u64 * FRAME_MS).saturating_sub(PAD_MS);
    let end_ms = ((end_index as u64 + 1) * FRAME_MS + PAD_MS).min(duration_ms);
    if offset_ms < 250 && end_ms + 250 >= duration_ms {
        return Ok(full);
    }
    Ok(SpeechWindow {
        offset_ms,
        end_ms: end_ms.max(offset_ms + 1),
        duration_ms,
    })
}

fn write_wav_slice(src: &Path, dest: &Path, start_ms: u64, end_ms: u64) -> Result<(), AppError> {
    let mut reader = hound::WavReader::open(src)?;
    let spec = reader.spec();
    let rate = u64::from(spec.sample_rate.max(1));
    let channels = usize::from(spec.channels.max(1));
    let samples: Vec<i16> = reader.samples::<i16>().collect::<Result<_, _>>()?;
    let start = ((start_ms * rate) / 1000) as usize * channels;
    let end = ((end_ms * rate) / 1000) as usize * channels;
    let slice = &samples[start.min(samples.len())..end.min(samples.len()).max(start.min(samples.len()))];
    if slice.is_empty() {
        return Err(AppError::msg("Could not prepare audio for transcription."));
    }
    let mut writer = hound::WavWriter::create(dest, spec)?;
    for sample in slice {
        writer.write_sample(*sample)?;
    }
    writer.finalize()?;
    Ok(())
}

fn ms_to_secs(value: u64) -> f64 {
    value as f64 / 1000.0
}

pub fn transcribe(
    app: &tauri::AppHandle,
    model_id: &str,
    audio_path: &Path,
    language: &str,
) -> Result<(Vec<TranscriptSegment>, Option<String>), AppError> {
    let model = settings::model_path(app, model_id)?;
    if !model.exists() {
        return Err(AppError::msg(
            "Download this Whisper model in Settings before running local transcription.",
        ));
    }
    let cli = find_cli(Some(app)).ok_or_else(|| {
        AppError::msg("Download Whisper.cpp in Settings to transcribe offline.")
    })?;
    let output_dir = audio_path.parent().unwrap_or(Path::new("."));
    let stem = audio_path.file_stem().and_then(|value| value.to_str()).unwrap_or("transcript");
    let json_path = output_dir.join(format!("{stem}.json"));
    let lang = whisper_language_flag(language);
    let window = detect_speech_window(audio_path)?;
    let trimmed_path = output_dir.join(format!("{stem}-speech.wav"));
    let input_path = if window.was_trimmed() {
        write_wav_slice(audio_path, &trimmed_path, window.offset_ms, window.end_ms)?;
        trimmed_path.clone()
    } else {
        audio_path.to_path_buf()
    };
    #[cfg(debug_assertions)]
    {
        eprintln!("[whisper] mode=transcribe translate=false language_flag={lang}");
        eprintln!(
            "[transcription-debug]\nrecordingDuration={:.2}\ntranscriptionInputDuration={:.2}\nsourceStartOffset={:.2}\nwasTrimmed={}",
            ms_to_secs(window.duration_ms),
            ms_to_secs(window.input_duration_ms()),
            ms_to_secs(window.offset_ms),
            window.was_trimmed()
        );
    }
    let output_prefix = output_dir.join(stem).to_string_lossy().into_owned();
    let model_flag = model.to_string_lossy().into_owned();
    let audio_flag = input_path.to_string_lossy().into_owned();
    let run = |with_dtw: bool| {
        let mut command = Command::new(&cli);
        if let Some(bin) = cli.parent() {
            command.env(
                "PATH",
                format!("{}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin", bin.display()),
            );
            command.env("DYLD_FALLBACK_LIBRARY_PATH", "/opt/homebrew/lib:/usr/local/lib");
        }
        command.args([
            "-m",
            &model_flag,
            "-f",
            &audio_flag,
            "-l",
            &lang,
            "-ojf",
            "-of",
            &output_prefix,
            "-np",
        ]);
        if with_dtw {
            command.args(["-dtw", model_id]);
        }
        command.status()
    };
    let status = run(true).or_else(|_| run(false)).map_err(|error| {
        AppError::msg(format!("Could not start whisper-cli: {error}"))
    })?;
    if !status.success() {
        let fallback = run(false).map_err(|error| AppError::msg(format!("Could not start whisper-cli: {error}")))?;
        if !fallback.success() {
            if window.was_trimmed() {
                let _ = fs::remove_file(&trimmed_path);
            }
            return Err(AppError::msg("Local transcription failed."));
        }
    }
    let json = fs_read_first(&json_path, &output_dir.join(format!("{stem}.json")));
    if window.was_trimmed() {
        let _ = fs::remove_file(&trimmed_path);
    }
    let json = json?;
    let parsed: WhisperCliFile =
        serde_json::from_str(&json).map_err(|_| AppError::msg("Could not parse local transcription output."))?;
    let detected = parsed
        .result
        .as_ref()
        .and_then(|item| item.language.clone())
        .filter(|value| !value.trim().is_empty());
    #[cfg(debug_assertions)]
    eprintln!("[whisper] detected_language={detected:?}");
    let offset = window.offset_ms;
    let segments: Vec<TranscriptSegment> = parsed
        .transcription
        .into_iter()
        .filter_map(|line| {
            let text = line.text.unwrap_or_default().trim().to_string();
            if text.is_empty() {
                return None;
            }
            let raw_from = line.timestamps.as_ref().and_then(|item| item.from.clone());
            let raw_to = line.timestamps.as_ref().and_then(|item| item.to.clone());
            let start = line
                .offsets
                .as_ref()
                .and_then(|item| item.from)
                .map(offset_ms)
                .or_else(|| raw_from.as_deref().and_then(parse_stamp));
            let end = line
                .offsets
                .as_ref()
                .and_then(|item| item.to)
                .map(offset_ms)
                .or_else(|| raw_to.as_deref().and_then(parse_stamp))
                .or(start);
            let start = start?;
            let end = end.unwrap_or(start).max(start);
            let words = tokens_to_words(&line.tokens)
                .into_iter()
                .map(|mut word| {
                    #[cfg(debug_assertions)]
                    eprintln!(
                        "[word-debug]\ntext={:?}\nrawStart={:.2}\nnormalizedStart={:.2}",
                        word.text,
                        ms_to_secs(word.start_ms),
                        ms_to_secs(word.start_ms.saturating_add(offset))
                    );
                    word.start_ms = word.start_ms.saturating_add(offset);
                    word.end_ms = word.end_ms.saturating_add(offset);
                    word
                })
                .collect();
            #[cfg(debug_assertions)]
            eprintln!(
                "[whisper-debug]\nrawSegmentStart={:.2}\nrawSegmentEnd={:.2}\nnormalizedSegmentStart={:.2}\nnormalizedSegmentEnd={:.2}",
                ms_to_secs(start),
                ms_to_secs(end),
                ms_to_secs(start.saturating_add(offset)),
                ms_to_secs(end.saturating_add(offset))
            );
            Some(
                TranscriptSegment::new(start.saturating_add(offset), end.saturating_add(offset), text)
                    .with_words(words),
            )
        })
        .collect();
    if segments.is_empty() {
        return Err(AppError::msg("Local transcription returned no text."));
    }
    Ok((segments, detected))
}

fn token_ms(token: &WhisperCliToken, field: impl Fn(&WhisperCliOffsets) -> Option<f64>, t: Option<f64>, stamp: Option<&str>) -> Option<u64> {
    token
        .offsets
        .as_ref()
        .and_then(field)
        .map(offset_ms)
        .or_else(|| stamp.and_then(parse_stamp))
        .or_else(|| t.map(|value| (value.max(0.0) * 10.0).round() as u64))
}

fn tokens_to_words(tokens: &[WhisperCliToken]) -> Vec<TranscriptWord> {
    let mut words: Vec<TranscriptWord> = Vec::new();
    for token in tokens {
        let raw = token.text.as_deref().unwrap_or("");
        if raw.is_empty() || raw.starts_with("[_") || raw.starts_with("<|") || raw == "[_BEG_]" {
            continue;
        }
        let start = token_ms(
            token,
            |item| item.from,
            token.t0,
            token.timestamps.as_ref().and_then(|item| item.from.as_deref()),
        );
        let end = token_ms(
            token,
            |item| item.to,
            token.t1,
            token.timestamps.as_ref().and_then(|item| item.to.as_deref()),
        )
        .or(start);
        let Some(start) = start else {
            continue;
        };
        let end = end.unwrap_or(start).max(start);
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        let starts_word = raw.starts_with(|mark: char| mark.is_whitespace()) || words.is_empty();
        if starts_word || matches!(trimmed.chars().next(), Some(mark) if ".,!?;:".contains(mark)) {
            if let Some(previous) = words.last_mut().filter(|_| !starts_word) {
                previous.text.push_str(trimmed);
                previous.end_ms = previous.end_ms.max(end);
            } else {
                words.push(TranscriptWord {
                    start_ms: start,
                    end_ms: end,
                    text: trimmed.to_string(),
                });
            }
        } else if let Some(previous) = words.last_mut() {
            previous.text.push_str(trimmed);
            previous.end_ms = previous.end_ms.max(end);
        } else {
            words.push(TranscriptWord {
                start_ms: start,
                end_ms: end,
                text: trimmed.to_string(),
            });
        }
    }
    words
}

fn fs_read_first(primary: &Path, secondary: &Path) -> Result<String, AppError> {
    if primary.exists() {
        return Ok(std::fs::read_to_string(primary)?);
    }
    if secondary.exists() {
        return Ok(std::fs::read_to_string(secondary)?);
    }
    Err(AppError::msg("whisper-cli did not write a transcript file."))
}

#[cfg(not(target_os = "macos"))]
fn copy_cli(app: &AppHandle, source: &Path) -> Result<PathBuf, AppError> {
    let dest = bundled_cli(app)?;
    if source != dest {
        fs::copy(source, &dest)?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&dest, fs::Permissions::from_mode(0o755))?;
    }
    Ok(dest)
}

#[cfg(target_os = "macos")]
fn brew_bin() -> Option<PathBuf> {
    ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]
        .into_iter()
        .map(PathBuf::from)
        .find(|path| path.is_file())
}

#[cfg(target_os = "macos")]
fn install_via_brew() -> Result<PathBuf, AppError> {
    let brew = brew_bin().ok_or_else(|| {
        AppError::msg("Homebrew was not found. Install Homebrew, then download Whisper.cpp here.")
    })?;
    let prefix = brew.parent().unwrap_or(Path::new("/opt/homebrew/bin"));
    let path = format!("{}:/usr/bin:/bin", prefix.display());
    let status = Command::new(&brew)
        .args(["install", "whisper-cpp"])
        .env("PATH", &path)
        .status()
        .map_err(|error| AppError::msg(format!("Could not start Homebrew: {error}")))?;
    if !status.success() {
        return Err(AppError::msg("Homebrew could not install whisper.cpp."));
    }
    extra_bin_dirs()
        .into_iter()
        .map(|dir| dir.join("whisper-cli"))
        .find(|path| path.is_file())
        .ok_or_else(|| AppError::msg("whisper-cli was installed but could not be found."))
}

#[cfg(not(target_os = "macos"))]
fn archive_url() -> Option<(&'static str, bool)> {
    #[cfg(all(windows, target_arch = "x86_64"))]
    {
        return Some((
            "https://github.com/ggml-org/whisper.cpp/releases/latest/download/whisper-bin-x64.zip",
            true,
        ));
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        return Some((
            "https://github.com/ggml-org/whisper.cpp/releases/latest/download/whisper-bin-ubuntu-x64.tar.gz",
            false,
        ));
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        return Some((
            "https://github.com/ggml-org/whisper.cpp/releases/latest/download/whisper-bin-ubuntu-arm64.tar.gz",
            false,
        ));
    }
    None
}

#[cfg(not(target_os = "macos"))]
fn extract_cli(archive: &Path, is_zip: bool, dest_dir: &Path) -> Result<PathBuf, AppError> {
    if is_zip {
        #[cfg(windows)]
        {
            let status = Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    &format!(
                        "Expand-Archive -Force -Path '{}' -DestinationPath '{}'",
                        archive.display(),
                        dest_dir.display()
                    ),
                ])
                .status()?;
            if !status.success() {
                return Err(AppError::msg("Could not unpack Whisper.cpp."));
            }
        }
        #[cfg(not(windows))]
        {
            let status = Command::new("ditto")
                .args(["-x", "-k", &archive.to_string_lossy(), &dest_dir.to_string_lossy()])
                .status()
                .or_else(|_| {
                    Command::new("unzip")
                        .args(["-o", &archive.to_string_lossy(), "-d", &dest_dir.to_string_lossy()])
                        .status()
                })?;
            if !status.success() {
                return Err(AppError::msg("Could not unpack Whisper.cpp."));
            }
        }
    } else {
        let status = Command::new("tar")
            .args(["-xzf", &archive.to_string_lossy(), "-C", &dest_dir.to_string_lossy()])
            .status()?;
        if !status.success() {
            return Err(AppError::msg("Could not unpack Whisper.cpp."));
        }
    }
    let mut found = None;
    if let Ok(entries) = fs::read_dir(dest_dir) {
        let mut stack: Vec<PathBuf> = entries.filter_map(|item| item.ok().map(|entry| entry.path())).collect();
        while let Some(path) = stack.pop() {
            if path.is_dir() {
                if let Ok(children) = fs::read_dir(&path) {
                    stack.extend(children.filter_map(|item| item.ok().map(|entry| entry.path())));
                }
                continue;
            }
            let name = path.file_name().and_then(|value| value.to_str()).unwrap_or("");
            if name == cli_name() || name == "whisper-cli" || name == "whisper-cli.exe" {
                found = Some(path);
                break;
            }
        }
    }
    found.ok_or_else(|| AppError::msg("The Whisper.cpp archive did not contain whisper-cli."))
}

pub async fn download_runtime(app: AppHandle) -> Result<(), AppError> {
    let _ = app.emit(
        "settings:model-progress",
        crate::settings::ModelProgress {
            id: "runtime".to_string(),
            received: 0,
            total: 1,
        },
    );
    if let Ok(broken) = bundled_cli(&app) {
        let _ = fs::remove_file(broken);
    }
    if find_cli(Some(&app)).is_some() {
        let _ = app.emit(
            "settings:model-progress",
            crate::settings::ModelProgress {
                id: "runtime".to_string(),
                received: 1,
                total: 1,
            },
        );
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        tauri::async_runtime::spawn_blocking(install_via_brew)
            .await
            .map_err(|error| AppError::msg(error.to_string()))??;
        let _ = app.emit(
            "settings:model-progress",
            crate::settings::ModelProgress {
                id: "runtime".to_string(),
                received: 1,
                total: 1,
            },
        );
        return Ok(());
    }
    #[cfg(not(target_os = "macos"))]
    {
        let Some((url, is_zip)) = archive_url() else {
            return Err(AppError::msg("Whisper.cpp download is not available on this system."));
        };
        let unpack = app_data_dir(&app)?.join("bin").join("whisper-tmp");
        fs::create_dir_all(&unpack)?;
        let archive = unpack.join(if is_zip { "whisper.zip" } else { "whisper.tar.gz" });
        let response = reqwest::Client::new().get(url).send().await?;
        if !response.status().is_success() {
            return Err(AppError::msg("Could not download Whisper.cpp."));
        }
        let total = response.content_length().unwrap_or(12_000_000);
        let mut file = fs::File::create(&archive)?;
        let mut received = 0_u64;
        let mut body = response;
        while let Some(chunk) = body.chunk().await? {
            use std::io::Write;
            file.write_all(&chunk)?;
            received += chunk.len() as u64;
            let _ = app.emit(
                "settings:model-progress",
                crate::settings::ModelProgress {
                    id: "runtime".to_string(),
                    received,
                    total,
                },
            );
        }
        file.sync_all()?;
        drop(file);
        let extracted = extract_cli(&archive, is_zip, &unpack)?;
        copy_cli(&app, &extracted)?;
        let _ = fs::remove_dir_all(unpack);
        return Ok(());
    }
}
