use base64::Engine;
use chrono::Timelike;
use core::ffi::c_void;
use image::{ImageBuffer, ImageFormat, RgbImage};
// use opencv::{imgproc::cvt_color, prelude::*};
use regex::Regex;
use std::collections::HashMap;
use std::io::Cursor;
use std::sync::Mutex;
use windows::{
    core::*,
    Win32::{
        Foundation::*,
        Graphics::Gdi::*,
        System::{DataExchange::*, Memory::*, Ole::CF_UNICODETEXT},
        UI::{Input::KeyboardAndMouse::*, WindowsAndMessaging::*},
    },
};

pub fn str_to_pcwstr(s: &str) -> PCWSTR {
    // 在末尾追加0
    let wide: Vec<u16> = s.encode_utf16().chain(std::iter::once(0)).collect();
    PCWSTR::from_raw(wide.as_ptr())
}

/// 查找具有指定类名或窗口名的顶级窗口的句柄。
///
/// # 参数
/// * `lp_class_name` - 窗口类名，如果为None则不指定类名。
/// * `lp_window_name` - 窗口名，如果为None则不指定窗口名。
///
/// # 返回
/// 返回找到的窗口的句柄，如果没有找到则返回None。
pub fn find_window(lp_class_name: Option<&str>, lp_window_name: Option<&str>) -> Option<HWND> {
    let class_name = lp_class_name.map_or(PCWSTR::null(), |name| str_to_pcwstr(name));
    let window_name = lp_window_name.map_or(PCWSTR::null(), |name| str_to_pcwstr(name));
    unsafe {
        let hwnd = FindWindowW(class_name, window_name);
        if hwnd.0 == 0 {
            None
        } else {
            Some(hwnd)
        }
    }
}

pub fn capture_rect_vec(rect: (i32, i32, i32, i32)) -> Vec<u8> {
    let (x1, y1, x2, y2) = rect;
    let raw = unsafe {
        let hdc = GetDC(None);
        let mem_dc = CreateCompatibleDC(hdc);
        let rect: RECT = RECT {
            left: x1,
            top: y1,
            right: x2,
            bottom: y2,
        };
        let rect_size: SIZE = SIZE {
            cx: rect.right - rect.left,
            cy: rect.bottom - rect.top,
        };

        let h_bmp = CreateCompatibleBitmap(hdc, rect_size.cx, rect_size.cy);
        let h_old_bmp = SelectObject(mem_dc, h_bmp);
        let _ = BitBlt(
            mem_dc,
            0,
            0,
            rect_size.cx,
            rect_size.cy,
            hdc,
            rect.left,
            rect.top,
            SRCCOPY,
        );
        let mut buffer = vec![0u8; (rect_size.cx * rect_size.cy * 4).try_into().unwrap()];
        let ptr = buffer.as_mut_ptr().cast();
        let result = GetDIBits(
            mem_dc,
            h_bmp,
            0,
            rect_size.cy as u32,
            Some(ptr as *mut c_void),
            &mut BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: rect_size.cx,
                    biHeight: rect_size.cy,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    biSizeImage: 0,
                    biXPelsPerMeter: 0,
                    biYPelsPerMeter: 0,
                    biClrUsed: 0,
                    biClrImportant: 0,
                },
                bmiColors: [RGBQUAD {
                    rgbBlue: 0,
                    rgbGreen: 0,
                    rgbRed: 0,
                    rgbReserved: 0,
                }],
            },
            DIB_RGB_COLORS,
        );
        if result == 0 {
            println!("获取位图数据失败！");
        }
        let _ = DeleteDC(hdc);
        let _ = DeleteDC(mem_dc);
        ReleaseDC(None, hdc);
        let _ = DeleteObject(h_old_bmp);
        let _ = DeleteObject(h_bmp);
        buffer
    };
    raw
}
pub fn capture_rect(rect: (i32, i32, i32, i32)) -> RgbImage {
    let (x1, y1, x2, y2) = rect;
    let w = (x2 - x1) as u32;
    let h = (y2 - y1) as u32;
    let raw = capture_rect_vec(rect);
    ImageBuffer::from_fn(w, h, move |x, y| {
        let y = h - y - 1;
        let b = raw[((y * w + x) * 4 + 0) as usize];
        let g = raw[((y * w + x) * 4 + 1) as usize];
        let r = raw[((y * w + x) * 4 + 2) as usize];
        image::Rgb([r, g, b])
    })
}

// pub fn capture_rect_mat(rect: (i32, i32, i32, i32)) -> Mat {
//     let (x1, y1, x2, y2) = rect;
//     let w = (x2 - x1) as i32;
//     let h = (y2 - y1) as i32;
//     let raw = capture_rect_vec(rect);

//     let mat = Mat::new_rows_cols_with_data(h, w, &raw).unwrap();
//     let mut mat_clone = mat.clone_pointee();
//     let _ = cvt_color(&mat, &mut mat_clone, opencv::imgproc::COLOR_BGRA2RGB, 0);
//     mat_clone
// }

pub fn img_to_bytes(img: &RgbImage) -> Vec<u8> {
    let mut buffer = Cursor::new(vec![]);
    let _ = img.write_to(&mut buffer, ImageFormat::Png);
    buffer.into_inner()
}

pub fn img_to_base64(img: &RgbImage) -> String {
    let bytes = img_to_bytes(img);
    base64::engine::general_purpose::STANDARD.encode(&bytes)
}

pub fn color_to_hex(color: u32) -> String {
    let r = color & 0xFF;
    let g = color >> 8 & 0xFF;
    let b = color >> 16 & 0xFF;

    format!("{:02X}{:02X}{:02X}", r, g, b)
}

fn check_color_raw(pixel: u32, pattern: &str) -> bool {
    let color = color_to_hex(pixel);

    if color.len() == pattern.len() {
        let color = color.chars().collect::<Vec<char>>();
        let pattern = pattern.chars().collect::<Vec<char>>();
        for i in 0..color.len() {
            if color[i] != pattern[i] && pattern[i] != '.' {
                return false;
            }
        }
        return true;
    }
    is_match(&color, pattern)
}

pub fn get_color(x: i32, y: i32) -> u32 {
    unsafe {
        let hdc = GetDC(None);
        let ret = GetPixel(hdc, x, y);
        ReleaseDC(None, hdc);
        ret.0
    }
}

pub fn get_color_batch(x: i32, y: i32) -> u32 {
    unsafe {
        let dc_cache = DC_CACHE.lock().unwrap();
        let ret = GetPixel(*dc_cache, x, y);
        ret.0
    }
}

pub fn check_color_regex(x: i32, y: i32, pattern: &str) -> bool {
    let pixel = get_color(x, y);
    check_color_raw(pixel, pattern)
}

pub fn check_color_regex_batch(x: i32, y: i32, pattern: &str) -> bool {
    let pixel = get_color_batch(x, y);
    check_color_raw(pixel, pattern)
}

lazy_static! {
    static ref DC_CACHE: Mutex<HDC> = Mutex::new(HDC::default());
}
pub fn save_dc() {
    unsafe {
        let hdc = GetDC(None);
        let mut dc_cache = DC_CACHE.lock().unwrap();
        ReleaseDC(None, *dc_cache);
        *dc_cache = hdc;
    }
}

pub fn free_dc() {
    unsafe {
        let mut dc_cache = DC_CACHE.lock().unwrap();
        if !(*dc_cache).0 == 0 {
            ReleaseDC(None, *dc_cache);
        }
        *dc_cache = HDC::default();
    }
}

pub fn is_match(s: &str, pattern: &str) -> bool {
    // 缓存编译好的正则表达式
    lazy_static! {
        static ref RE_CACHE: Mutex<HashMap<String, Regex>> = Mutex::new(HashMap::new());
    }

    let mut cache = RE_CACHE.lock().unwrap();
    if !cache.contains_key(pattern) {
        cache.insert(pattern.to_string(), Regex::new(pattern).unwrap());
    }
    let re = cache.get(pattern).unwrap();
    re.is_match(s)
}

#[allow(unused)]
pub fn set_foreground_window(hwnd: HWND) -> bool {
    unsafe {
        // 显示窗口并激活
        ShowWindow(hwnd, SW_RESTORE);
        let result = SetForegroundWindow(hwnd);
        result == TRUE
    }
}

pub fn sleep(ms: u32) {
    std::thread::sleep(std::time::Duration::from_millis(ms as u64));
}

pub fn sleepf(s: f64) {
    std::thread::sleep(std::time::Duration::from_secs_f64(s));
}

pub fn mouse_down() {
    unsafe { mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0) }
}

pub fn mouse_up() {
    unsafe { mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0) }
}

// 左键单击
pub fn click(x: i32, y: i32, count: u32) {
    mouse_move_to(x, y);
    for _ in 0..count {
        mouse_down();
        sleep(1);
        mouse_up();
    }
}

fn key_to_vkey(key: &str) -> u16 {
    match key {
        "a" => 0x41,
        "b" => 0x42,
        "c" => 0x43,
        "d" => 0x44,
        "e" => 0x45,
        "f" => 0x46,
        "g" => 0x47,
        "h" => 0x48,
        "i" => 0x49,
        "j" => 0x4A,
        "k" => 0x4B,
        "l" => 0x4C,
        "m" => 0x4D,
        "n" => 0x4E,
        "o" => 0x4F,
        "p" => 0x50,
        "q" => 0x51,
        "r" => 0x52,
        "s" => 0x53,
        "t" => 0x54,
        "u" => 0x55,
        "v" => 0x56,
        "w" => 0x57,
        "x" => 0x58,
        "y" => 0x59,
        "z" => 0x5A,
        "0" => 0x30,
        "1" => 0x31,
        "2" => 0x32,
        "3" => 0x33,
        "4" => 0x34,
        "5" => 0x35,
        "6" => 0x36,
        "7" => 0x37,
        "8" => 0x38,
        "9" => 0x39,
        "space" => 0x20,
        "enter" => 0x0D,
        "backspace" => 0x08,
        "esc" => 0x1B,
        "escape" => 0x1B,
        "left" => 0x25,
        "up" => 0x26,
        "right" => 0x27,
        "down" => 0x28,
        "shift" => 0xA0,
        "lshift" => 0xA0,
        "rshift" => 0xA1,
        "ctrl" => 0xA2,
        "lctrl" => 0xA2,
        "rctrl" => 0xA3,
        "alt" => 0xA4,
        "lalt" => 0xA4,
        "ralt" => 0xA5,
        "tab" => 0x09,
        "capslock" => 0x14,
        "numlock" => 0x90,
        "scrolllock" => 0x91,
        "printscreen" => 0x2C,
        "insert" => 0x2D,
        "del" => 0x2E,
        "delete" => 0x2E,
        "home" => 0x24,
        "end" => 0x23,
        "pageup" => 0x21,
        "pagedown" => 0x22,
        "f1" => 0x70,
        "f2" => 0x71,
        "f3" => 0x72,
        "f4" => 0x73,
        "f5" => 0x74,
        "f6" => 0x75,
        "f7" => 0x76,
        "f8" => 0x77,
        "f9" => 0x78,
        "f10" => 0x79,
        "f11" => 0x7A,
        "f12" => 0x7B,
        "lwin" => 0x5B,
        "rwin" => 0x5C,
        "apps" => 0x5D,
        "media_next_track" => 0xB0,
        "media_prev_track" => 0xB1,
        "media_play_pause" => 0xB3,
        "media_stop" => 0xB2,
        "volume_mute" => 0xAD,
        "volume_down" => 0xAE,
        "volume_up" => 0xAF,
        "media_select" => 0xB5,
        "browser_back" => 0xA6,
        "browser_forward" => 0xA7,
        "browser_refresh" => 0xA8,
        "browser_stop" => 0xA9,
        "browser_search" => 0xAA,
        "browser_favorites" => 0xAB,
        "browser_home" => 0xAC,
        "launch_mail" => 0xB4,
        "launch_media_select" => 0xB6,
        "launch_app1" => 0xB7,
        "launch_app2" => 0xB8,
        _ => 0,
    }
}

fn key_down(key: u16) {
    unsafe { keybd_event(key as u8, 0, KEYBD_EVENT_FLAGS(0), 0) }
}

fn key_up(key: u16) {
    unsafe { keybd_event(key as u8, 0, KEYEVENTF_KEYUP, 0) }
}

pub fn key_press(key: &str, duration: u32) {
    let vkey = key_to_vkey(key);
    if vkey == 0 {
        panic!("无效的按键: {}", key);
    }
    key_down(vkey);
    if duration > 0 {
        sleep(duration);
    }
    key_up(vkey);
}

/// 组合键
pub fn combo_key_press(keys: &[&str], duration: u32) {
    let ve = keys
        .iter()
        .map(|key| key_to_vkey(key))
        .filter(|key| *key != 0)
        .collect::<Vec<u16>>();
    let vkeys = ve.as_slice();
    for &vkey in vkeys {
        key_down(vkey);
    }
    if duration > 0 {
        sleep(duration);
    }
    for &vkey in vkeys.iter().rev() {
        key_up(vkey);
    }
}

/// 鼠标移动 (绝对坐标)
pub fn mouse_move_to(x: i32, y: i32) {
    unsafe {
        // 移动鼠标
        mouse_event(
            MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE,
            (x << 16) / GetSystemMetrics(SM_CXSCREEN),
            (y << 16) / GetSystemMetrics(SM_CYSCREEN),
            0,
            0,
        )
    };
}

#[allow(unused)]
/// 鼠标移动 (相对坐标)
pub fn mouse_move(dx: i32, dy: i32) {
    unsafe { mouse_event(MOUSEEVENTF_MOVE, dx, dy, 0, 0) };
}

#[allow(unused)]
/// 设置剪贴板文本
pub fn set_clipboard_text(text: &str) {
    unsafe {
        if OpenClipboard(None).is_err() {
            println!("[set_clipboard_text] OpenClipboard failed");
            return;
        }
        EmptyClipboard();
        let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
        let wlen = (wide.len() * std::mem::size_of::<u16>()) as usize;
        let h_global = GlobalAlloc(GMEM_MOVEABLE, wlen);
        if let Ok(h_global) = h_global {
            let p_global = GlobalLock(h_global);
            if !p_global.is_null() {
                let p_text = p_global as *mut u16;
                std::ptr::copy_nonoverlapping(wide.as_ptr(), p_text, wide.len());
                if SetClipboardData(CF_UNICODETEXT.0 as u32, HANDLE(h_global.0 as isize)).is_err() {
                    println!("[set_clipboard_text] SetClipboardData failed");
                    GlobalFree(h_global);
                }
                GlobalUnlock(h_global);
            } else {
                println!("[set_clipboard_text] GlobalLock failed");
                GlobalFree(h_global);
            }
        } else {
            println!("[set_clipboard_text] GlobalAlloc failed");
        }
        CloseClipboard();
    }
}

#[allow(unused)]
/// 获取剪贴板文本
pub fn get_clipboard_text() -> String {
    unsafe {
        OpenClipboard(None);
        let h_global = GetClipboardData(CF_UNICODETEXT.0 as u32);
        if let Ok(h_global) = h_global {
            let h_global = HGLOBAL(h_global.0 as *mut c_void);
            let p_global = GlobalLock(h_global);
            let p_text = p_global as *const u16;
            let len = (0..).take_while(|&i| *p_text.offset(i) != 0).count();
            let slice = std::slice::from_raw_parts(p_text, len);
            let text = String::from_utf16_lossy(slice);
            GlobalUnlock(h_global);
            CloseClipboard();
            text
        } else {
            println!("[get_clipboard_text] GetClipboardData failed");
            CloseClipboard();
            String::default()
        }
    }
}

pub fn retry_http<T>(builder: T, max_retries: u64) -> String
where
    T: Fn() -> reqwest::blocking::RequestBuilder,
{
    use retry::delay::Fixed;
    use retry::retry_with_index;
    use retry::OperationResult;
    let result = retry_with_index(Fixed::from_millis(2000), |current_try| {
        if current_try > max_retries {
            return OperationResult::Err(format!("did not succeed within {} tries", max_retries));
        }

        let res = builder().send();
        if res.is_err() {
            return OperationResult::Retry("failed to send request, retrying...".to_string());
        }
        let res = res.unwrap();
        if res.status().is_success() {
            let text = res.text();
            if text.is_err() {
                return OperationResult::Retry("http post failed, retrying...".to_string());
            }
            let text = text.unwrap();
            return OperationResult::Ok(text);
        }

        OperationResult::Retry("http post failed, retrying...".to_string())
    });
    if let Ok(result) = result {
        result
    } else {
        result.err().unwrap().to_string()
    }
}

pub fn http_post(url: &str, data: &str) -> String {
    let client = reqwest::blocking::Client::new();
    retry_http(
        || {
            client
                .post(url)
                .header("Content-Type", "application/json")
                .body(data.to_string())
        },
        3,
    )
}

pub fn http_get(url: &str) -> String {
    let client = reqwest::blocking::Client::new();
    retry_http(|| client.get(url), 3)
}

pub fn pixel_search(rect: (i32, i32, i32, i32), rgb: u32, tolerance: f64) -> Option<(i32, i32)> {
    let (left, top, right, bottom) = rect;
    let img = capture_rect(rect);
    for x in 0..(right - left) {
        for y in 0..(bottom - top) {
            let pixel = img.get_pixel(x as u32, y as u32);
            if tolerance == 0.0 {
                let pixel =
                    pixel.0[2] as u32 | (pixel.0[1] as u32) << 8 | (pixel.0[0] as u32) << 16;
                if pixel == rgb {
                    return Some((x + left, y + top));
                }
            } else {
                let r1 = (rgb >> 16) as u8;
                let g1 = (rgb >> 8) as u8;
                let b1 = (rgb) as u8;
                let r2 = pixel.0[0];
                let g2 = pixel.0[1];
                let b2 = pixel.0[2];
                let dr = r1 as f64 - r2 as f64;
                let dg = g1 as f64 - g2 as f64;
                let db = b1 as f64 - b2 as f64;
                let distance = (dr * dr + dg * dg + db * db).sqrt() / 255.0;
                if distance <= tolerance {
                    return Some((x + left, y + top));
                }
            }
        }
    }
    None
}

pub fn pixel_search_reverse(
    rect: (i32, i32, i32, i32),
    rgb: u32,
    tolerance: f64,
) -> Option<(i32, i32)> {
    let (left, top, right, bottom) = rect;
    let img = capture_rect(rect);
    for x in (0..(right - left)).rev() {
        for y in (0..(bottom - top)).rev() {
            let pixel = img.get_pixel(x as u32, y as u32);
            if tolerance == 0.0 {
                let pixel =
                    pixel.0[0] as u32 | (pixel.0[1] as u32) << 8 | (pixel.0[2] as u32) << 16;
                if pixel == rgb {
                    return Some((x + left, y + top));
                }
            } else {
                let r1 = (rgb >> 16) as u8;
                let g1 = (rgb >> 8) as u8;
                let b1 = (rgb) as u8;
                let r2 = pixel.0[0];
                let g2 = pixel.0[1];
                let b2 = pixel.0[2];
                let dr = r1 as f64 - r2 as f64;
                let dg = g1 as f64 - g2 as f64;
                let db = b1 as f64 - b2 as f64;
                let distance = (dr * dr + dg * dg + db * db).sqrt() / 255.0;
                if distance <= tolerance {
                    return Some((x + left, y + top));
                }
            }
        }
    }
    None
}

pub fn get_time_str() -> String {
    let now = chrono::Local::now();
    if now.hour() < 5 {
        "晚上".to_string()
    } else if now.hour() < 9 {
        "早上".to_string()
    } else if now.hour() < 11 {
        "上午".to_string()
    } else if now.hour() < 14 {
        "中午".to_string()
    } else if now.hour() < 17 {
        "下午".to_string()
    } else {
        "晚上".to_string()
    }
}
