//! The one-second intro: the VeilCast logo and name above the header's QR
//! code, rendered straight into raw yuv420p frames, and reading the code back
//! from a decoded frame. The intro is never scrambled or inverted, so a viewer
//! can read it before knowing any parameter.

use veilcast_core::{IntroHeader, Yuv420Layout};

/// Length of the intro; the browser scans this window for the QR code.
pub const INTRO_SECONDS: f64 = 1.0;
/// Quiet zone in modules on each side, as the QR standard requires.
const QUIET_ZONE: usize = 4;
const Y_BLACK: u8 = 16;

// Layout in fractions of the frame's shorter side, so portrait, landscape and
// square uploads get the same composition. The card (symbol plus its white
// quiet zone) keeps the 60% the plain intro used, so the code reads through
// platform transcodes as before.
const CARD: f64 = 0.60;
const LOGO: f64 = 0.12;
/// Height of the wordmark's ink, set beside the logo.
const TITLE: f64 = 0.075;
const TITLE_GAP: f64 = 0.03;
const HEADER_GAP: f64 = 0.045;
/// A smaller logo would be mush; such frames get the card alone.
const MIN_LOGO: usize = 24;
/// Behind everything: the logo tile's navy, a little darker.
const BACKGROUND: [f64; 3] = [13.0, 36.0, 85.0];
const WHITE: [f64; 3] = [255.0, 255.0, 255.0];

/// Built by `scripts/generate-intro-assets.mjs`.
const LOGO_QOI: &[u8] = include_bytes!("../assets/intro-logo.qoi");
const TITLE_QOI: &[u8] = include_bytes!("../assets/intro-title.qoi");

/// Frames in a `seconds`-long intro at the given frame rate.
pub fn frame_count(fps: f64, seconds: f64) -> u64 {
    (fps * seconds).round().max(1.0) as u64
}

/// One intro frame for `layout`: logo and name on top, the header's QR code
/// (error correction H) on a white rounded card below, the group centred on a
/// navy limited-range yuv420p frame. The symbol keeps an integer number of
/// pixels per module so its edges stay crisp through our own encode.
pub fn render_frame(header: &IntroHeader, layout: Yuv420Layout) -> Result<Vec<u8>, String> {
    let digits = header.encode().map_err(|e| e.to_string())?;
    let code = qrcode::QrCode::with_error_correction_level(digits.as_bytes(), qrcode::EcLevel::H)
        .map_err(|e| format!("无法生成二维码: {e}"))?;
    let modules = code.width();
    let dark: Vec<bool> = code
        .to_colors()
        .into_iter()
        .map(|color| color == qrcode::Color::Dark)
        .collect();

    let (width, height) = (layout.width(), layout.height());
    let shorter = width.min(height);
    let span = |fraction: f64| (shorter as f64 * fraction).round() as usize;
    let scale = span(CARD) / (modules + 2 * QUIET_ZONE);
    if scale == 0 {
        return Err(format!(
            "画面 {width}×{height} 太小，放不下 {modules} 模块的二维码"
        ));
    }
    let card = scale * (modules + 2 * QUIET_ZONE);

    let title = Picture::decode(TITLE_QOI)?;
    let (logo_side, title_height) = (span(LOGO), span(TITLE));
    let title_width = (title.width * title_height + title.height / 2) / title.height;
    let (title_gap, header_gap) = (span(TITLE_GAP), span(HEADER_GAP));
    let row = logo_side + title_gap + title_width;
    let with_header =
        logo_side >= MIN_LOGO && row <= width && logo_side + header_gap + card <= height;
    let stack = if with_header {
        logo_side + header_gap + card
    } else {
        card
    };
    let top = (height - stack) / 2;
    let card_top = top
        + if with_header {
            logo_side + header_gap
        } else {
            0
        };
    let card_left = (width - card) / 2;

    let mut frame = vec![0u8; layout.buffer_len()];
    let mut canvas = Canvas::new(layout, &mut frame)?;
    canvas.fill(BACKGROUND);
    // Corners round off within the quiet zone, well clear of the finder patterns.
    let radius = 2.0 * scale as f64;
    canvas.blend(card_left, card_top, card, card, |x, y| {
        (rounded_rect_coverage(x, y, card, radius), WHITE)
    });
    let (x0, y0) = (
        card_left + QUIET_ZONE * scale,
        card_top + QUIET_ZONE * scale,
    );
    for my in 0..modules {
        for mx in 0..modules {
            if dark[my * modules + mx] {
                canvas.fill_luma(x0 + mx * scale, y0 + my * scale, scale, Y_BLACK);
            }
        }
    }
    if with_header {
        let left = (width - row) / 2;
        let logo = Picture::decode(LOGO_QOI)?.resized(logo_side, logo_side);
        canvas.blend(left, top, logo_side, logo_side, |x, y| logo.pixel(x, y));
        let title = title.resized(title_width, title_height);
        let title_top = top + (logo_side - title_height) / 2;
        canvas.blend(
            left + logo_side + title_gap,
            title_top,
            title_width,
            title_height,
            |x, y| title.pixel(x, y),
        );
    }
    Ok(frame)
}

/// Coverage of pixel (x, y) by a `side`-square with rounded corners, from its
/// centre's signed distance to the edge: one pixel of anti-aliasing.
fn rounded_rect_coverage(x: usize, y: usize, side: usize, radius: f64) -> f64 {
    let half = side as f64 / 2.0;
    let qx = (x as f64 + 0.5 - half).abs() - (half - radius);
    let qy = (y as f64 + 0.5 - half).abs() - (half - radius);
    let distance = qx.max(0.0).hypot(qy.max(0.0)) + qx.max(qy).min(0.0) - radius;
    (0.5 - distance).clamp(0.0, 1.0)
}

/// BT.709 limited-range Y'CbCr of an 8-bit R'G'B' colour.
fn to_yuv([r, g, b]: [f64; 3]) -> [f64; 3] {
    let (r, g, b) = (r / 255.0, g / 255.0, b / 255.0);
    let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    [
        16.0 + 219.0 * y,
        128.0 + 224.0 * (b - y) / 1.8556,
        128.0 + 224.0 * (r - y) / 1.5748,
    ]
}

/// The three planes of one frame, drawn on in RGB and stored as yuv420p.
struct Canvas<'a> {
    planes: [&'a mut [u8]; 3],
    width: usize,
    height: usize,
    strides: [usize; 2],
}

impl<'a> Canvas<'a> {
    fn new(layout: Yuv420Layout, frame: &'a mut [u8]) -> Result<Self, String> {
        Ok(Self {
            planes: layout.split_mut(frame).map_err(|e| e.to_string())?,
            width: layout.width(),
            height: layout.height(),
            strides: [layout.luma().stride(), layout.chroma().stride()],
        })
    }

    fn fill(&mut self, rgb: [f64; 3]) {
        let [y, u, v] = to_yuv(rgb).map(|value| value.round() as u8);
        let (width, height) = (self.width, self.height);
        let [luma, chroma] = self.strides;
        for row in 0..height {
            self.planes[0][row * luma..row * luma + width].fill(y);
        }
        for row in 0..height / 2 {
            let range = row * chroma..row * chroma + width / 2;
            self.planes[1][range.clone()].fill(u);
            self.planes[2][range].fill(v);
        }
    }

    /// A `side`-square of solid luma, leaving chroma as it is.
    fn fill_luma(&mut self, left: usize, top: usize, side: usize, value: u8) {
        for row in top..top + side {
            let start = row * self.strides[0] + left;
            self.planes[0][start..start + side].fill(value);
        }
    }

    /// Blends the `width`×`height` source at (`left`, `top`), where
    /// `source(x, y)` gives the coverage and colour of each of its pixels.
    /// Each chroma sample takes the mean of its four luma pixels.
    fn blend(
        &mut self,
        left: usize,
        top: usize,
        width: usize,
        height: usize,
        source: impl Fn(usize, usize) -> (f64, [f64; 3]),
    ) {
        let right = (left + width).min(self.width);
        let bottom = (top + height).min(self.height);
        let [luma, chroma] = self.strides;
        for y in top..bottom {
            for x in left..right {
                let (alpha, rgb) = source(x - left, y - top);
                if alpha > 0.0 {
                    let at = y * luma + x;
                    let old = f64::from(self.planes[0][at]);
                    self.planes[0][at] = (old + (to_yuv(rgb)[0] - old) * alpha).round() as u8;
                }
            }
        }
        for cy in top / 2..bottom.div_ceil(2) {
            for cx in left / 2..right.div_ceil(2) {
                let (mut alpha, mut u, mut v) = (0.0, 0.0, 0.0);
                for (x, y) in
                    [(0, 0), (1, 0), (0, 1), (1, 1)].map(|(dx, dy)| (2 * cx + dx, 2 * cy + dy))
                {
                    if (left..right).contains(&x) && (top..bottom).contains(&y) {
                        let (a, rgb) = source(x - left, y - top);
                        let [_, cb, cr] = to_yuv(rgb);
                        alpha += a / 4.0;
                        u += a * cb / 4.0;
                        v += a * cr / 4.0;
                    }
                }
                if alpha > 0.0 {
                    let at = cy * chroma + cx;
                    for (plane, value) in [(1, u), (2, v)] {
                        let old = f64::from(self.planes[plane][at]);
                        self.planes[plane][at] = (old * (1.0 - alpha) + value).round() as u8;
                    }
                }
            }
        }
    }
}

/// A straight-alpha RGBA image.
struct Picture {
    width: usize,
    height: usize,
    rgba: Vec<[f64; 4]>,
}

impl Picture {
    /// Decodes a QOI image (https://qoiformat.org), the format of the embedded intro assets.
    fn decode(bytes: &[u8]) -> Result<Self, String> {
        let invalid = || "片头素材损坏".to_string();
        if bytes.len() < 14 || &bytes[..4] != b"qoif" {
            return Err(invalid());
        }
        let dimension =
            |at: usize| u32::from_be_bytes(bytes[at..at + 4].try_into().unwrap()) as usize;
        let (width, height) = (dimension(4), dimension(8));
        let count = width.checked_mul(height).ok_or_else(invalid)?;
        let mut rgba = Vec::with_capacity(count);
        let mut seen = [[0u8; 4]; 64];
        let mut pixel = [0u8, 0, 0, 255];
        let mut at = 14;
        let mut next = || -> Result<u8, String> {
            let byte = *bytes.get(at).ok_or_else(invalid)?;
            at += 1;
            Ok(byte)
        };
        while rgba.len() < count {
            let op = next()?;
            let mut run = 1;
            match op {
                0xfe => pixel[..3].copy_from_slice(&[next()?, next()?, next()?]),
                0xff => pixel = [next()?, next()?, next()?, next()?],
                _ => match op >> 6 {
                    0 => pixel = seen[usize::from(op & 0x3f)],
                    1 => {
                        for (channel, shift) in [(0, 4), (1, 2), (2, 0)] {
                            pixel[channel] = pixel[channel]
                                .wrapping_add((op >> shift) & 3)
                                .wrapping_sub(2);
                        }
                    }
                    2 => {
                        let green = (op & 0x3f).wrapping_sub(32);
                        let second = next()?;
                        pixel[0] =
                            pixel[0].wrapping_add(green.wrapping_add(second >> 4).wrapping_sub(8));
                        pixel[1] = pixel[1].wrapping_add(green);
                        pixel[2] =
                            pixel[2].wrapping_add(green.wrapping_add(second & 0xf).wrapping_sub(8));
                    }
                    _ => run = usize::from(op & 0x3f) + 1,
                },
            }
            let [r, g, b, a] = pixel.map(usize::from);
            seen[(r * 3 + g * 5 + b * 7 + a * 11) % 64] = pixel;
            for _ in 0..run.min(count - rgba.len()) {
                rgba.push(pixel.map(f64::from));
            }
        }
        Ok(Self {
            width,
            height,
            rgba,
        })
    }

    /// This image resampled to `width`×`height`: each target pixel averages a
    /// grid of bilinear samples over its footprint, in premultiplied alpha so
    /// transparent neighbours do not darken the edges.
    fn resized(&self, width: usize, height: usize) -> Self {
        let (sx, sy) = (
            self.width as f64 / width as f64,
            self.height as f64 / height as f64,
        );
        let taps = |ratio: f64| (ratio.ceil() as usize).clamp(2, 8);
        let (nx, ny) = (taps(sx), taps(sy));
        let mut rgba = Vec::with_capacity(width * height);
        for y in 0..height {
            for x in 0..width {
                let mut sum = [0.0; 4];
                for j in 0..ny {
                    for i in 0..nx {
                        let fx = (x as f64 + (i as f64 + 0.5) / nx as f64) * sx;
                        let fy = (y as f64 + (j as f64 + 0.5) / ny as f64) * sy;
                        let [r, g, b, a] = self.bilinear(fx, fy);
                        for (total, value) in sum.iter_mut().zip([r * a, g * a, b * a, a]) {
                            *total += value;
                        }
                    }
                }
                let alpha = sum[3];
                rgba.push(if alpha > 0.0 {
                    [
                        sum[0] / alpha,
                        sum[1] / alpha,
                        sum[2] / alpha,
                        alpha / (nx * ny) as f64,
                    ]
                } else {
                    [0.0; 4]
                });
            }
        }
        Self {
            width,
            height,
            rgba,
        }
    }

    /// Straight-alpha colour at a point, pixel centres at half-integers; alpha in 0..=1.
    fn bilinear(&self, fx: f64, fy: f64) -> [f64; 4] {
        let clamp = |value: f64, limit: usize| value.clamp(0.0, (limit - 1) as f64);
        let (x, y) = (clamp(fx - 0.5, self.width), clamp(fy - 0.5, self.height));
        let (x0, y0) = (x.floor() as usize, y.floor() as usize);
        let (x1, y1) = ((x0 + 1).min(self.width - 1), (y0 + 1).min(self.height - 1));
        let (tx, ty) = (x - x0 as f64, y - y0 as f64);
        let at = |x: usize, y: usize| self.rgba[y * self.width + x];
        let mut out = [0.0; 4];
        for (corner, weight) in [
            (at(x0, y0), (1.0 - tx) * (1.0 - ty)),
            (at(x1, y0), tx * (1.0 - ty)),
            (at(x0, y1), (1.0 - tx) * ty),
            (at(x1, y1), tx * ty),
        ] {
            let alpha = corner[3] / 255.0 * weight;
            for channel in 0..3 {
                out[channel] += corner[channel] * alpha;
            }
            out[3] += alpha;
        }
        if out[3] > 0.0 {
            for channel in 0..3 {
                out[channel] /= out[3];
            }
        }
        out
    }

    /// Coverage and colour of pixel (x, y), as [`Canvas::blend`] takes them.
    fn pixel(&self, x: usize, y: usize) -> (f64, [f64; 3]) {
        let [r, g, b, a] = self.rgba[y * self.width + x];
        (a, [r, g, b])
    }
}

/// Looks for a VeilCast header in an 8-bit greyscale frame (row-major, no
/// padding). Other QR codes in the frame are ignored.
pub fn read_frame(width: usize, height: usize, luma: &[u8]) -> Option<IntroHeader> {
    if luma.len() < width * height || width == 0 || height == 0 {
        return None;
    }
    let mut image =
        rqrr::PreparedImage::prepare_from_greyscale(width, height, |x, y| luma[y * width + x]);
    image
        .detect_grids()
        .iter()
        .filter_map(|grid| grid.decode().ok())
        .find_map(|(_, text)| IntroHeader::parse(text.trim()).ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn header() -> IntroHeader {
        IntroHeader {
            width: 1920,
            height: 1078,
            tile: 40,
            margin: 0,
            invert: true,
            audio_ms: 250,
            audio_mirror: true,
            seed: Some(0x88d4_4f40_babc_4fa2),
        }
    }

    fn render(width: usize, height: usize) -> (Vec<u8>, Yuv420Layout) {
        let layout = Yuv420Layout::packed(width, height).unwrap();
        (render_frame(&header(), layout).unwrap(), layout)
    }

    #[test]
    fn every_shape_reads_back() {
        for (width, height) in [
            (640, 360),
            (1280, 720),
            (720, 1280),
            (1080, 1080),
            (2560, 1376),
            (3840, 1080),
            (200, 120),
        ] {
            let (frame, layout) = render(width, height);
            let [y, _, _] = layout.split(&frame).unwrap();
            assert_eq!(
                read_frame(width, height, y),
                Some(header()),
                "{width}×{height}"
            );
        }
    }

    #[test]
    fn the_code_survives_a_platform_downscale_to_360p() {
        let (frame, layout) = render(2560, 1376);
        let [y, _, _] = layout.split(&frame).unwrap();
        // A 4×4 box filter, as a transcode to 640×344 roughly does.
        let (width, height) = (640, 344);
        let small: Vec<u8> = (0..width * height)
            .map(|i| {
                let (x, row) = (i % width * 4, i / width * 4);
                let sum: u32 = (0..16)
                    .map(|k| u32::from(y[(row + k / 4) * 2560 + x + k % 4]))
                    .sum();
                (sum / 16) as u8
            })
            .collect();
        assert_eq!(read_frame(width, height, &small), Some(header()));
    }

    #[test]
    fn the_header_shows_where_there_is_room_and_only_there() {
        let background = to_yuv(BACKGROUND).map(|value| value.round() as u8);
        // 1280×720: the logo sits above the card, left of centre, in colour.
        let (frame, layout) = render(1280, 720);
        let [y, u, v] = layout.split(&frame).unwrap();
        assert_eq!(
            (y[0], u[0], v[0]),
            (background[0], background[1], background[2])
        );
        let logo = span(720, LOGO);
        let top = (720 - (logo + span(720, HEADER_GAP) + card(720))) / 2;
        let row: Vec<u8> = y[(top + logo / 2) * 1280..(top + logo / 2 + 1) * 1280].to_vec();
        assert!(
            row.iter().any(|&luma| luma > background[0] + 40),
            "logo and title are drawn"
        );
        let chroma_row = (top + logo / 2) / 2;
        assert!(
            u[chroma_row * 640..(chroma_row + 1) * 640]
                .iter()
                .any(|&value| value > background[1] + 5)
        );
        // 200×120: no room for a legible header, so everything outside the card is background.
        let (frame, layout) = render(200, 120);
        let [y, _, _] = layout.split(&frame).unwrap();
        let card = card(120);
        let (left, top) = ((200 - card) / 2, (120 - card) / 2);
        for (i, &luma) in y.iter().enumerate() {
            let (x, row) = (i % 200, i / 200);
            if !(left..left + card).contains(&x) || !(top..top + card).contains(&row) {
                assert_eq!(luma, background[0], "pixel {x},{row}");
            }
        }
    }

    fn span(shorter: usize, fraction: f64) -> usize {
        (shorter as f64 * fraction).round() as usize
    }

    fn card(shorter: usize) -> usize {
        let modules = qrcode::QrCode::with_error_correction_level(
            header().encode().unwrap().as_bytes(),
            qrcode::EcLevel::H,
        )
        .unwrap()
        .width()
            + 2 * QUIET_ZONE;
        span(shorter, CARD) / modules * modules
    }

    #[test]
    fn the_embedded_assets_decode() {
        let logo = Picture::decode(LOGO_QOI).unwrap();
        assert_eq!((logo.width, logo.height), (384, 384));
        assert_eq!(logo.rgba[0][3], 0.0, "transparent corner");
        assert_eq!(logo.rgba[192 * 384 + 192][3], 255.0, "opaque middle");
        let title = Picture::decode(TITLE_QOI).unwrap();
        assert!(title.width > 3 * title.height);
        assert!(title.rgba.iter().all(|&[r, g, b, _]| [r, g, b] == WHITE));
        assert!(title.rgba.iter().any(|pixel| pixel[3] == 255.0));
        assert!(
            Picture::decode(b"qoif\0\0\0\x02\0\0\0\x02\x04\0").is_err(),
            "truncated"
        );
    }

    #[test]
    fn frames_without_our_code_read_as_none() {
        let layout = Yuv420Layout::packed(64, 64).unwrap();
        let blank = vec![235; layout.buffer_len()];
        assert_eq!(read_frame(64, 64, &blank[..64 * 64]), None);
        assert!(render_frame(&header(), Yuv420Layout::packed(40, 40).unwrap()).is_err());
    }

    #[test]
    fn intro_frame_count_follows_the_frame_rate() {
        assert_eq!(frame_count(30.0, INTRO_SECONDS), 30);
        assert_eq!(frame_count(29.97, INTRO_SECONDS), 30);
        assert_eq!(frame_count(60.0, 1.0), 60);
    }
}
