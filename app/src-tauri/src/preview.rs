//! Small RGBA pictures of the frames a job is processing, for the UI to show
//! the input and the output side by side while it runs.
//!
//! Wire format of one message (little-endian), both pictures in one payload:
//! `u16 input width, u16 input height, u16 output width, u16 output height`,
//! then the input's RGBA bytes, then the output's.

use vatrix_core::Yuv420Layout;

/// Longest side of a preview picture; the UI shows each in about half the window.
pub const MAX_SIDE: usize = 480;

/// Nearest-neighbour downscale of a limited-range BT.709 I420 frame to RGBA,
/// no side longer than `max_side`. Returns the picture's width and height.
pub fn rgba(
    layout: Yuv420Layout,
    frame: &[u8],
    max_side: usize,
) -> Result<(usize, usize, Vec<u8>), String> {
    let [y, u, v] = layout.split(frame).map_err(|e| e.to_string())?;
    let (width, height) = (layout.width(), layout.height());
    let scale = (max_side as f64 / width.max(height) as f64).min(1.0);
    let out_width = ((width as f64 * scale).round() as usize).max(1);
    let out_height = ((height as f64 * scale).round() as usize).max(1);
    let (luma_stride, chroma_stride) = (layout.luma().stride(), layout.chroma().stride());
    let mut pixels = Vec::with_capacity(out_width * out_height * 4);
    for row in 0..out_height {
        let sy = ((row * height) / out_height).min(height - 1);
        for column in 0..out_width {
            let sx = ((column * width) / out_width).min(width - 1);
            let luma = 1.164 * (f32::from(y[sy * luma_stride + sx]) - 16.0);
            let chroma = (sy / 2) * chroma_stride + sx / 2;
            let cb = f32::from(u[chroma]) - 128.0;
            let cr = f32::from(v[chroma]) - 128.0;
            let clamp = |value: f32| value.round().clamp(0.0, 255.0) as u8;
            pixels.extend_from_slice(&[
                clamp(luma + 1.793 * cr),
                clamp(luma - 0.213 * cb - 0.533 * cr),
                clamp(luma + 2.112 * cb),
                255,
            ]);
        }
    }
    Ok((out_width, out_height, pixels))
}

/// One message carrying the input and output pictures, see the module docs.
pub fn pair(
    input: (Yuv420Layout, &[u8]),
    output: (Yuv420Layout, &[u8]),
) -> Result<Vec<u8>, String> {
    let (in_width, in_height, in_pixels) = rgba(input.0, input.1, MAX_SIDE)?;
    let (out_width, out_height, out_pixels) = rgba(output.0, output.1, MAX_SIDE)?;
    let mut message = Vec::with_capacity(8 + in_pixels.len() + out_pixels.len());
    for side in [in_width, in_height, out_width, out_height] {
        message.extend_from_slice(&(side as u16).to_le_bytes());
    }
    message.extend_from_slice(&in_pixels);
    message.extend_from_slice(&out_pixels);
    Ok(message)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Limited-range black on the left half, white on the right, neutral chroma.
    fn frame(width: usize, height: usize) -> (Yuv420Layout, Vec<u8>) {
        let layout = Yuv420Layout::packed(width, height).unwrap();
        let mut buffer = vec![128u8; layout.buffer_len()];
        for row in 0..height {
            for column in 0..width {
                buffer[row * width + column] = if column < width / 2 { 16 } else { 235 };
            }
        }
        (layout, buffer)
    }

    #[test]
    fn previews_keep_the_aspect_and_fit_the_longest_side() {
        let (layout, buffer) = frame(2560, 1376);
        let (width, height, pixels) = rgba(layout, &buffer, MAX_SIDE).unwrap();
        assert_eq!((width, height), (480, 258));
        assert_eq!(pixels.len(), width * height * 4);
        // Limited-range black and white come out as full-range black and white.
        assert_eq!(&pixels[..4], &[0, 0, 0, 255]);
        assert_eq!(&pixels[(width - 1) * 4..width * 4], &[255, 255, 255, 255]);

        let (small, buffer) = frame(64, 36);
        assert_eq!(
            rgba(small, &buffer, MAX_SIDE).unwrap().0,
            64,
            "never upscaled"
        );
    }

    #[test]
    fn a_pair_is_one_header_and_two_pictures() {
        let (portrait, tall) = frame(720, 1280);
        let (landscape, wide) = frame(1280, 720);
        let message = pair((portrait, &tall), (landscape, &wide)).unwrap();
        let side = |at: usize| u16::from_le_bytes([message[at], message[at + 1]]) as usize;
        assert_eq!([side(0), side(2), side(4), side(6)], [270, 480, 480, 270]);
        assert_eq!(message.len(), 8 + 270 * 480 * 4 * 2);
    }
}
