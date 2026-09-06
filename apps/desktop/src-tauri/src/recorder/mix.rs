use std::path::Path;

use crate::error::AppError;

pub fn mix_wavs(left: &Path, right: &Path, output: &Path) -> Result<(), AppError> {
    let first = read_wav(left)?;
    let second = read_wav(right)?;
    let sample_rate = first.sample_rate.max(second.sample_rate).max(1);
    let channels = first.channels.max(second.channels).max(1);
    let a = resample(&first.samples, first.channels, first.sample_rate, channels, sample_rate);
    let b = resample(&second.samples, second.channels, second.sample_rate, channels, sample_rate);
    let frames = a.len().max(b.len());
    let mut mixed = Vec::with_capacity(frames);
    for index in 0..frames {
        let left_s = *a.get(index).unwrap_or(&0) as i32;
        let right_s = *b.get(index).unwrap_or(&0) as i32;
        mixed.push((left_s + right_s).clamp(i16::MIN as i32, i16::MAX as i32) as i16);
    }
    let spec = hound::WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(output, spec)?;
    for sample in mixed {
        writer.write_sample(sample)?;
    }
    writer.finalize()?;
    Ok(())
}

struct WavData {
    samples: Vec<i16>,
    sample_rate: u32,
    channels: u16,
}

fn read_wav(path: &Path) -> Result<WavData, AppError> {
    let mut reader = hound::WavReader::open(path)?;
    let spec = reader.spec();
    let samples = reader.samples::<i16>().collect::<Result<Vec<_>, _>>()?;
    Ok(WavData {
        samples,
        sample_rate: spec.sample_rate.max(1),
        channels: spec.channels.max(1),
    })
}

fn resample(samples: &[i16], from_channels: u16, from_rate: u32, to_channels: u16, to_rate: u32) -> Vec<i16> {
    let mono = to_mono(samples, from_channels);
    if mono.is_empty() {
        return Vec::new();
    }
    let src_frames = mono.len() as u64;
    let dst_frames = (src_frames * u64::from(to_rate.max(1)) / u64::from(from_rate.max(1))).max(1);
    let mut out = Vec::with_capacity(dst_frames as usize * usize::from(to_channels.max(1)));
    for frame in 0..dst_frames {
        let pos = frame as f64 * (src_frames.saturating_sub(1) as f64) / (dst_frames.saturating_sub(1).max(1) as f64);
        let index = pos.floor() as usize;
        let frac = pos - index as f64;
        let a = mono[index] as f64;
        let b = *mono.get(index + 1).unwrap_or(&mono[index]) as f64;
        let sample = (a + (b - a) * frac).round().clamp(i16::MIN as f64, i16::MAX as f64) as i16;
        for _ in 0..to_channels {
            out.push(sample);
        }
    }
    out
}

fn to_mono(samples: &[i16], channels: u16) -> Vec<i16> {
    let channels = usize::from(channels.max(1));
    samples
        .chunks(channels)
        .map(|frame| {
            let sum: i32 = frame.iter().map(|sample| i32::from(*sample)).sum();
            (sum / channels as i32) as i16
        })
        .collect()
}
