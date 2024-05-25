use windows::Win32::{Foundation::*, Graphics::Gdi::ClientToScreen, UI::WindowsAndMessaging::*};

use crate::util::*;

pub struct GameControl {
    pub hwnd: HWND,
    pub w: u32,
    pub h: u32,
}

#[allow(non_snake_case, unused)]
impl GameControl {
    pub fn new(hwnd: HWND) -> Self {
        set_foreground_window(hwnd);
        let mut rect = RECT::default();
        let _ = unsafe { GetClientRect(hwnd, &mut rect).unwrap() };
        let mut point = POINT::default();
        let _ = unsafe { ClientToScreen(hwnd, &mut point) };
        let w = (rect.right - rect.left) as u32;
        let h = (rect.bottom - rect.top) as u32;
        Self { hwnd, w, h }
    }

    pub fn isForeground(&self) -> bool {
        unsafe { GetForegroundWindow() == self.hwnd }
    }

    pub fn focus(&self) {
        set_foreground_window(self.hwnd);
    }

    pub fn toScreenPos(&self, x: i32, y: i32) -> (i32, i32) {
        let mut point = POINT { x, y };
        let _ = unsafe { ClientToScreen(self.hwnd, &mut point) };
        (
            point.x * self.w as i32 / 1600,
            point.y * self.h as i32 / 900,
        )
    }

    pub fn toScreenRect(&self, rect: (i32, i32, i32, i32)) -> (i32, i32, i32, i32) {
        let (x1, y1, x2, y2) = rect;
        let (x, y) = self.toScreenPos(x1, y1);
        let w = (x2 - x1) * self.w as i32 / 1600;
        let h = (y2 - y1) * self.h as i32 / 900;
        (x, y, x + w as i32, y + h as i32)
    }

    pub fn MouseMove(&self, x: i32, y: i32) {
        let (x, y) = self.toScreenPos(x, y);
        click(x, y, 0);
    }

    pub fn Click(&self, x: i32, y: i32) {
        let (x, y) = self.toScreenPos(x, y);
        click(x, y, 1);
    }

    pub fn PressKey(&self, key: &str) {
        key_press(key, 0);
    }

    pub fn Send(&self, text: &str) {
        // let old = get_clipboard_text();
        set_clipboard_text(text);
        combo_key_press(&["ctrl", "v"], 0);
        sleep(100);
        // set_clipboard_text(old.as_str());
    }

    pub fn CheckColor(&self, x: i32, y: i32, color: &str) -> bool {
        let (x, y) = self.toScreenPos(x, y);
        check_color_regex(x, y, color)
    }

    pub fn CheckColorS(&self, x: i32, y: i32, color: &str) -> bool {
        let (x, y) = self.toScreenPos(x, y);
        check_color_regex_batch(x, y, color)
    }

    pub fn GetColor(&self, x: i32, y: i32) -> String {
        let (x, y) = self.toScreenPos(x, y);
        color_to_hex(get_color(x, y))
    }

    pub fn GetColorS(&self, x: i32, y: i32) -> String {
        let (x, y) = self.toScreenPos(x, y);
        color_to_hex(get_color_batch(x, y))
    }

    pub fn WaitColor(&self, x: i32, y: i32, color: &str, timeout: f64) -> bool {
        let (x, y) = self.toScreenPos(x, y);
        let start = std::time::Instant::now();
        while start.elapsed().as_secs_f64() < timeout {
            if check_color_regex(x, y, color) {
                return true;
            }
        }
        false
    }

    pub fn PixelSearch(
        &self,
        rect: (i32, i32, i32, i32),
        rgb: u32,
        tolerance: f64,
    ) -> Option<(i32, i32)> {
        let (x1, y1, x2, y2) = rect;
        let rect = self.toScreenRect(rect);
        let (offset_x, offset_y) = (rect.0 - x1, rect.1 - y1);
        let result = pixel_search(rect, rgb, tolerance);
        if let Some((x, y)) = result {
            Some((x - offset_x, y - offset_y))
        } else {
            None
        }
    }

    pub fn PixelSearchRev(
        &self,
        rect: (i32, i32, i32, i32),
        rgb: u32,
        tolerance: f64,
    ) -> Option<(i32, i32)> {
        let (x1, y1, x2, y2) = rect;
        let rect = self.toScreenRect(rect);
        let (offset_x, offset_y) = (rect.0 - x1, rect.1 - y1);
        let result = pixel_search_reverse(rect, rgb, tolerance);
        if let Some((x, y)) = result {
            Some((x - offset_x, y - offset_y))
        } else {
            None
        }
    }
}
