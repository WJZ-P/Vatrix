//! Renders the intro frame at the given sizes as PNG, for checking the layout:
//!   cargo run -p veilcast-app --example intro_preview -- 2560x1376 720x1280
//! Files land in `target/intro-preview/`; needs ffmpeg as the app does.

use std::process::{Command, Stdio};

use veilcast_app_lib::intro::render_frame;
use veilcast_core::{IntroHeader, Yuv420Layout};

fn main() {
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/intro-preview");
    std::fs::create_dir_all(&dir).unwrap();
    let ffmpeg =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tools/ffmpeg/ffmpeg.exe");
    let header = IntroHeader {
        width: 2560,
        height: 1370,
        tile: 32,
        margin: 0,
        invert: true,
        audio_ms: 0,
        audio_mirror: true,
        seed: None,
    };
    let sizes: Vec<String> = std::env::args().skip(1).collect();
    for size in if sizes.is_empty() {
        vec!["1920x1080".to_string()]
    } else {
        sizes
    } {
        let (width, height) = size.split_once('x').expect("WIDTHxHEIGHT");
        let (width, height): (usize, usize) = (width.parse().unwrap(), height.parse().unwrap());
        let frame = render_frame(&header, Yuv420Layout::packed(width, height).unwrap()).unwrap();
        let output = dir.join(format!("intro-{width}x{height}.png"));
        let mut child = Command::new(&ffmpeg)
            .args(["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "yuv420p"])
            .args(["-s", &size, "-i", "-"])
            .args([
                "-vf",
                "scale=in_color_matrix=bt709:in_range=tv",
                "-frames:v",
                "1",
            ])
            .arg(&output)
            .stdin(Stdio::piped())
            .spawn()
            .unwrap();
        std::io::Write::write_all(child.stdin.as_mut().unwrap(), &frame).unwrap();
        drop(child.stdin.take());
        assert!(child.wait().unwrap().success());
        println!("{}", output.display());
    }
}
