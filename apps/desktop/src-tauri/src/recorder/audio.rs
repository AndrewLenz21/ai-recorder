use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, SyncSender};
use std::sync::Arc;
use std::thread::{self, JoinHandle};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Sample, SampleFormat, Stream, StreamConfig};

use crate::error::AppError;

enum WriterCommand {
    Samples(Vec<i16>),
    Finish,
}

pub struct AudioCapture {
    _stream: Stream,
    writing: Arc<AtomicBool>,
    frames: Arc<AtomicU64>,
    sample_rate: u32,
    channels: u16,
    writer_tx: SyncSender<WriterCommand>,
    writer_thread: Option<JoinHandle<Result<(), String>>>,
}

// CoreAudio marks cpal::Stream as !Send. The stream is only used through
// RecorderEngine's mutex and is never accessed from the audio callback thread.
unsafe impl Send for AudioCapture {}
unsafe impl Sync for AudioCapture {}

impl AudioCapture {
    pub fn start(path: PathBuf) -> Result<Self, AppError> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| AppError::msg("No microphone was found."))?;
        let supported = device.default_input_config().map_err(|error| {
            AppError::msg(format!("Could not open the microphone. {error}"))
        })?;

        let sample_format = supported.sample_format();
        let config: StreamConfig = supported.clone().into();
        let sample_rate = config.sample_rate.0;
        let channels = config.channels;
        let writing = Arc::new(AtomicBool::new(true));
        let frames = Arc::new(AtomicU64::new(0));
        let (writer_tx, writer_rx) = mpsc::sync_channel::<WriterCommand>(64);

        let spec = hound::WavSpec {
            channels,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let writer_thread = thread::spawn(move || {
            let file = File::create(&path).map_err(|error| error.to_string())?;
            let mut writer = hound::WavWriter::new(BufWriter::new(file), spec)
                .map_err(|error| error.to_string())?;
            while let Ok(command) = writer_rx.recv() {
                match command {
                    WriterCommand::Samples(samples) => {
                        for sample in samples {
                            writer.write_sample(sample).map_err(|error| error.to_string())?;
                        }
                    }
                    WriterCommand::Finish => break,
                }
            }
            writer.finalize().map_err(|error| error.to_string())?;
            Ok(())
        });

        let err_fn = |error| eprintln!("audio stream error: {error}");
        let stream = match sample_format {
            SampleFormat::F32 => build_stream::<f32>(
                &device,
                &config,
                writing.clone(),
                frames.clone(),
                writer_tx.clone(),
                err_fn,
            )?,
            SampleFormat::I16 => build_stream::<i16>(
                &device,
                &config,
                writing.clone(),
                frames.clone(),
                writer_tx.clone(),
                err_fn,
            )?,
            SampleFormat::I32 => build_stream::<i32>(
                &device,
                &config,
                writing.clone(),
                frames.clone(),
                writer_tx.clone(),
                err_fn,
            )?,
            SampleFormat::U16 => build_stream::<u16>(
                &device,
                &config,
                writing.clone(),
                frames.clone(),
                writer_tx.clone(),
                err_fn,
            )?,
            other => {
                return Err(AppError::msg(format!(
                    "Unsupported microphone sample format: {other}"
                )));
            }
        };

        stream
            .play()
            .map_err(|error| AppError::msg(format!("Could not start the microphone. {error}")))?;

        Ok(Self {
            _stream: stream,
            writing,
            frames,
            sample_rate,
            channels,
            writer_tx,
            writer_thread: Some(writer_thread),
        })
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    pub fn channels(&self) -> u16 {
        self.channels
    }

    pub fn duration_ms(&self) -> u64 {
        let frames = self.frames.load(Ordering::Relaxed);
        frames.saturating_mul(1000) / u64::from(self.sample_rate.max(1))
    }

    pub fn set_writing(&self, enabled: bool) {
        self.writing.store(enabled, Ordering::Relaxed);
    }

    pub fn stop(mut self) -> Result<u64, AppError> {
        self.writing.store(false, Ordering::Relaxed);
        let duration_ms = self.duration_ms();
        let _ = self.writer_tx.send(WriterCommand::Finish);
        if let Some(thread) = self.writer_thread.take() {
            match thread.join() {
                Ok(Ok(())) => Ok(duration_ms),
                Ok(Err(error)) => Err(AppError::msg(error)),
                Err(_) => Err(AppError::msg("Audio writer stopped unexpectedly.")),
            }
        } else {
            Ok(duration_ms)
        }
    }
}

fn build_stream<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    writing: Arc<AtomicBool>,
    frames: Arc<AtomicU64>,
    writer_tx: SyncSender<WriterCommand>,
    err_fn: impl Fn(cpal::StreamError) + Send + 'static,
) -> Result<Stream, AppError>
where
    T: cpal::Sample + cpal::SizedSample,
    i16: cpal::FromSample<T>,
{
    let channels = u64::from(config.channels.max(1));
    device
        .build_input_stream(
            config,
            move |data: &[T], _| {
                if !writing.load(Ordering::Relaxed) {
                    return;
                }
                let frame_count = data.len() as u64 / channels;
                frames.fetch_add(frame_count, Ordering::Relaxed);
                let samples = data.iter().map(|sample| i16::from_sample(*sample)).collect();
                let _ = writer_tx.try_send(WriterCommand::Samples(samples));
            },
            err_fn,
            None,
        )
        .map_err(|error| AppError::msg(format!("Could not start audio capture. {error}")))
}
