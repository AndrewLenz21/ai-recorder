use std::ffi::c_void;
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::mpsc::{self, SyncSender};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use block2::RcBlock;
use dispatch2::{DispatchQueue, DispatchQueueAttr};
use objc2::rc::Retained;
use objc2::runtime::{NSObject, NSObjectProtocol, ProtocolObject};
use objc2::{define_class, msg_send, AnyThread, DefinedClass};
use objc2_foundation::{NSArray, NSError};
use objc2_screen_capture_kit::{
    SCContentFilter, SCShareableContent, SCStream, SCStreamConfiguration, SCStreamOutput,
    SCStreamOutputType,
};

use crate::error::AppError;

enum WriterCommand {
    Header { sample_rate: u32, channels: u16 },
    Samples(Vec<i16>),
    Finish,
}

struct OutputIvars {
    writing: Arc<AtomicBool>,
    frames: Arc<AtomicU64>,
    writer_tx: SyncSender<WriterCommand>,
    origin: Instant,
    padded: AtomicBool,
    sample_rate: Arc<AtomicU32>,
    channels: Arc<AtomicU32>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "AIRecorderSystemAudioOutput"]
    #[ivars = OutputIvars]
    struct StreamOutput;

    unsafe impl NSObjectProtocol for StreamOutput {}

    unsafe impl SCStreamOutput for StreamOutput {
        #[unsafe(method(stream:didOutputSampleBuffer:ofType:))]
        unsafe fn stream_did_output(
            &self,
            _stream: &SCStream,
            sample_buffer: &objc2_core_media::CMSampleBuffer,
            of_type: SCStreamOutputType,
        ) {
            if of_type != SCStreamOutputType::Audio {
                return;
            }
            let ivars = self.ivars();
            if !ivars.writing.load(Ordering::Relaxed) {
                return;
            }
            let Some((rate, channels, samples)) = pcm_from_sample_buffer(sample_buffer) else {
                return;
            };
            if ivars.sample_rate.load(Ordering::Relaxed) == 0 {
                ivars.sample_rate.store(rate, Ordering::Relaxed);
                ivars.channels.store(u32::from(channels), Ordering::Relaxed);
                let _ = ivars.writer_tx.try_send(WriterCommand::Header {
                    sample_rate: rate,
                    channels,
                });
            }
            if !ivars.padded.swap(true, Ordering::Relaxed) {
                let pad_ms = ivars.origin.elapsed().as_millis() as u64;
                let pad_frames = pad_ms.saturating_mul(u64::from(rate.max(1))) / 1000;
                if pad_frames > 0 {
                    ivars.frames.fetch_add(pad_frames, Ordering::Relaxed);
                    let silence = vec![0_i16; pad_frames as usize * usize::from(channels.max(1))];
                    let _ = ivars.writer_tx.try_send(WriterCommand::Samples(silence));
                }
            }
            let frame_count = samples.len() as u64 / u64::from(channels.max(1));
            ivars.frames.fetch_add(frame_count, Ordering::Relaxed);
            let _ = ivars.writer_tx.try_send(WriterCommand::Samples(samples));
        }
    }
);

impl StreamOutput {
    fn new(
        writing: Arc<AtomicBool>,
        frames: Arc<AtomicU64>,
        writer_tx: SyncSender<WriterCommand>,
        origin: Instant,
        sample_rate: Arc<AtomicU32>,
        channels: Arc<AtomicU32>,
    ) -> Retained<Self> {
        let this = Self::alloc().set_ivars(OutputIvars {
            writing,
            frames,
            writer_tx,
            origin,
            padded: AtomicBool::new(false),
            sample_rate,
            channels,
        });
        unsafe { msg_send![super(this), init] }
    }
}

pub struct SystemAudioCapture {
    _stream: Retained<SCStream>,
    _output: Retained<StreamOutput>,
    frames: Arc<AtomicU64>,
    sample_rate: Arc<AtomicU32>,
    channels: Arc<AtomicU32>,
    writer_tx: SyncSender<WriterCommand>,
    writer_thread: Option<JoinHandle<Result<(), String>>>,
}

unsafe impl Send for SystemAudioCapture {}
unsafe impl Sync for SystemAudioCapture {}

impl SystemAudioCapture {
    pub fn start(path: PathBuf, writing: Arc<AtomicBool>, origin: Instant) -> Result<Self, AppError> {
        let _ = crate::permissions::request("screen");
        let content = shareable_content()?;
        let displays = unsafe { content.displays() };
        let display = displays
            .firstObject()
            .ok_or_else(|| AppError::msg("No display was available for system audio capture."))?;
        let filter = unsafe {
            SCContentFilter::initWithDisplay_excludingWindows(
                SCContentFilter::alloc(),
                &display,
                &NSArray::new(),
            )
        };
        let config = unsafe { SCStreamConfiguration::new() };
        unsafe {
            config.setCapturesAudio(true);
            config.setExcludesCurrentProcessAudio(true);
            config.setWidth(2);
            config.setHeight(2);
            config.setShowsCursor(false);
            config.setMinimumFrameInterval(objc2_core_media::CMTime {
                value: 1,
                timescale: 1,
                flags: objc2_core_media::CMTimeFlags(1),
                epoch: 0,
            });
        }
        let stream = unsafe {
            SCStream::initWithFilter_configuration_delegate(SCStream::alloc(), &filter, &config, None)
        };
        let frames = Arc::new(AtomicU64::new(0));
        let sample_rate = Arc::new(AtomicU32::new(0));
        let channels = Arc::new(AtomicU32::new(0));
        let (writer_tx, writer_rx) = mpsc::sync_channel::<WriterCommand>(256);
        let writer_thread = thread::spawn(move || {
            let mut writer = None;
            while let Ok(command) = writer_rx.recv() {
                match command {
                    WriterCommand::Header {
                        sample_rate,
                        channels,
                    } => {
                        let spec = hound::WavSpec {
                            channels,
                            sample_rate,
                            bits_per_sample: 16,
                            sample_format: hound::SampleFormat::Int,
                        };
                        let file = File::create(&path).map_err(|error| error.to_string())?;
                        writer = Some(
                            hound::WavWriter::new(BufWriter::new(file), spec)
                                .map_err(|error| error.to_string())?,
                        );
                    }
                    WriterCommand::Samples(samples) => {
                        if let Some(writer) = writer.as_mut() {
                            for sample in samples {
                                writer.write_sample(sample).map_err(|error| error.to_string())?;
                            }
                        }
                    }
                    WriterCommand::Finish => break,
                }
            }
            if let Some(writer) = writer {
                writer.finalize().map_err(|error| error.to_string())?;
            }
            Ok(())
        });
        let output = StreamOutput::new(
            writing,
            frames.clone(),
            writer_tx.clone(),
            origin,
            sample_rate.clone(),
            channels.clone(),
        );
        let queue = DispatchQueue::new("com.ai.recorder.system-audio", DispatchQueueAttr::SERIAL);
        unsafe {
            stream
                .addStreamOutput_type_sampleHandlerQueue_error(
                    ProtocolObject::from_ref(&*output),
                    SCStreamOutputType::Audio,
                    Some(&queue),
                )
                .map_err(|error| AppError::msg(error.to_string()))?;
        }
        start_stream(&stream)?;
        Ok(Self {
            _stream: stream,
            _output: output,
            frames,
            sample_rate,
            channels,
            writer_tx,
            writer_thread: Some(writer_thread),
        })
    }

    pub fn duration_ms(&self) -> u64 {
        let rate = self.sample_rate.load(Ordering::Relaxed).max(1);
        self.frames.load(Ordering::Relaxed).saturating_mul(1000) / u64::from(rate)
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate.load(Ordering::Relaxed).max(1)
    }

    pub fn channels(&self) -> u16 {
        self.channels.load(Ordering::Relaxed).max(1) as u16
    }

    pub fn stop(mut self) -> Result<u64, AppError> {
        let duration_ms = self.duration_ms();
        stop_stream(&self._stream);
        let _ = self.writer_tx.send(WriterCommand::Finish);
        if let Some(thread) = self.writer_thread.take() {
            match thread.join() {
                Ok(Ok(())) => Ok(duration_ms),
                Ok(Err(error)) => Err(AppError::msg(error)),
                Err(_) => Err(AppError::msg("System audio writer stopped unexpectedly.")),
            }
        } else {
            Ok(duration_ms)
        }
    }
}

fn shareable_content() -> Result<Retained<SCShareableContent>, AppError> {
    let (tx, rx) = mpsc::channel();
    let block = RcBlock::new(move |content: *mut SCShareableContent, error: *mut NSError| {
        if !error.is_null() {
            let message = unsafe { &*error }.localizedDescription().to_string();
            let _ = tx.send(Err(message));
            return;
        }
        if content.is_null() {
            let _ = tx.send(Err("Screen capture content was unavailable.".to_string()));
            return;
        }
        let retained = unsafe { Retained::retain(content) };
        let _ = tx.send(Ok(retained));
    });
    unsafe {
        SCShareableContent::getShareableContentExcludingDesktopWindows_onScreenWindowsOnly_completionHandler(
            false,
            true,
            &block,
        );
    }
    match rx.recv_timeout(Duration::from_secs(8)) {
        Ok(Ok(Some(content))) => Ok(content),
        Ok(Ok(None)) => Err(AppError::msg("Screen capture content was unavailable.")),
        Ok(Err(message)) => Err(AppError::msg(message)),
        Err(_) => Err(AppError::msg("Timed out waiting for system audio permission.")),
    }
}

fn start_stream(stream: &SCStream) -> Result<(), AppError> {
    let (tx, rx) = mpsc::channel();
    let block = RcBlock::new(move |error: *mut NSError| {
        if error.is_null() {
            let _ = tx.send(Ok(()));
        } else {
            let message = unsafe { &*error }.localizedDescription().to_string();
            let _ = tx.send(Err(message));
        }
    });
    unsafe {
        stream.startCaptureWithCompletionHandler(Some(&block));
    }
    match rx.recv_timeout(Duration::from_secs(8)) {
        Ok(Ok(())) => Ok(()),
        Ok(Err(message)) => Err(AppError::msg(message)),
        Err(_) => Err(AppError::msg("Timed out starting system audio capture.")),
    }
}

fn stop_stream(stream: &SCStream) {
    let (tx, rx) = mpsc::channel::<()>();
    let block = RcBlock::new(move |_error: *mut NSError| {
        let _ = tx.send(());
    });
    unsafe {
        stream.stopCaptureWithCompletionHandler(Some(&block));
    }
    let _ = rx.recv_timeout(Duration::from_secs(4));
}

#[derive(Clone, Copy)]
#[repr(C)]
struct AudioBuffer {
    number_channels: u32,
    data_byte_size: u32,
    data: *mut c_void,
}

#[repr(C)]
struct AudioBufferList {
    number_buffers: u32,
    buffers: [AudioBuffer; 8],
}

#[repr(C)]
struct AudioStreamBasicDescription {
    sample_rate: f64,
    format_id: u32,
    format_flags: u32,
    bytes_per_packet: u32,
    frames_per_packet: u32,
    bytes_per_frame: u32,
    channels_per_frame: u32,
    bits_per_channel: u32,
    reserved: u32,
}

const K_CM_SAMPLE_BUFFER_AUDIO_BUFFER_LIST_ASSURE_16_BYTE_ALIGNMENT: u32 = 1;

#[link(name = "CoreMedia", kind = "framework")]
extern "C" {
    fn CMSampleBufferGetFormatDescription(sbuf: *const c_void) -> *const c_void;
    fn CMAudioFormatDescriptionGetStreamBasicDescription(desc: *const c_void) -> *const AudioStreamBasicDescription;
    fn CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
        sbuf: *const c_void,
        buffer_list_size_needed_out: *mut usize,
        buffer_list_out: *mut AudioBufferList,
        buffer_list_size: usize,
        structure_allocator: *const c_void,
        block_allocator: *const c_void,
        flags: u32,
        block_buffer_out: *mut *mut c_void,
    ) -> i32;
    fn CFRelease(cf: *const c_void);
}

fn pcm_from_sample_buffer(sample_buffer: &objc2_core_media::CMSampleBuffer) -> Option<(u32, u16, Vec<i16>)> {
    unsafe {
        let sbuf = std::ptr::from_ref(sample_buffer) as *const c_void;
        let desc = CMSampleBufferGetFormatDescription(sbuf);
        if desc.is_null() {
            return None;
        }
        let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(desc);
        if asbd.is_null() {
            return None;
        }
        let asbd = &*asbd;
        let rate = asbd.sample_rate.round().max(1.0) as u32;
        let channels = asbd.channels_per_frame.max(1) as u16;
        let mut list = AudioBufferList {
            number_buffers: 0,
            buffers: [AudioBuffer {
                number_channels: 0,
                data_byte_size: 0,
                data: std::ptr::null_mut(),
            }; 8],
        };
        let mut block: *mut c_void = std::ptr::null_mut();
        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sbuf,
            std::ptr::null_mut(),
            &mut list,
            std::mem::size_of::<AudioBufferList>(),
            std::ptr::null(),
            std::ptr::null(),
            K_CM_SAMPLE_BUFFER_AUDIO_BUFFER_LIST_ASSURE_16_BYTE_ALIGNMENT,
            &mut block,
        );
        if status != 0 {
            return None;
        }
        let samples = interleaved_i16(&list, channels);
        if !block.is_null() {
            CFRelease(block);
        }
        Some((rate, channels, samples))
    }
}

fn interleaved_i16(list: &AudioBufferList, channels: u16) -> Vec<i16> {
    let buffer_count = list.number_buffers.min(8) as usize;
    if buffer_count == 0 {
        return Vec::new();
    }
    let is_float = list.buffers[0].data_byte_size > 0 && {
        let frames = if list.buffers[0].number_channels.max(1) == 0 {
            0
        } else {
            list.buffers[0].data_byte_size / 4 / list.buffers[0].number_channels.max(1)
        };
        frames > 0
    };
    if buffer_count == 1 {
        let buffer = &list.buffers[0];
        if buffer.data.is_null() {
            return Vec::new();
        }
        let count = (buffer.data_byte_size / 4) as usize;
        let data = unsafe { std::slice::from_raw_parts(buffer.data as *const f32, count) };
        return data.iter().map(|sample| float_to_i16(*sample)).collect();
    }
    let frames = (list.buffers[0].data_byte_size / 4) as usize;
    let mut out = vec![0_i16; frames * usize::from(channels.max(1))];
    let used = buffer_count.min(usize::from(channels.max(1)));
    for channel in 0..used {
        let buffer = &list.buffers[channel];
        if buffer.data.is_null() {
            continue;
        }
        let data = unsafe { std::slice::from_raw_parts(buffer.data as *const f32, frames.min((buffer.data_byte_size / 4) as usize)) };
        for (frame, sample) in data.iter().enumerate() {
            let index = frame * usize::from(channels.max(1)) + channel;
            if let Some(slot) = out.get_mut(index) {
                *slot = float_to_i16(*sample);
            }
        }
    }
    let _ = is_float;
    out
}

fn float_to_i16(sample: f32) -> i16 {
    (sample.clamp(-1.0, 1.0) * f32::from(i16::MAX)).round() as i16
}
