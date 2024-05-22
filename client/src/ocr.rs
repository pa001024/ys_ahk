use std::ffi::CStr;

use encoding::{all::GBK, DecoderTrap, Encoding};
use windows::{
    core::*,
    Win32::{Foundation::*, System::LibraryLoader::*},
};

#[allow(unused)]
pub struct DDDDOcr {
    dll: HMODULE,
    identify_func: Option<extern "system" fn(*const u8, i32) -> *const u8>,
}

#[allow(unused)]
impl DDDDOcr {
    /// 创建一个新的 DDDDOcr 对象 包含初始化
    pub fn new() -> Self {
        // 获取系统临时文件夹路径
        let temp_dir = std::path::Path::new("ddocr_x86.dll");
        let dll_bytes = include_bytes!("../ddocr_x86.dll");
        if !temp_dir.exists() {
            std::fs::write(temp_dir, dll_bytes).unwrap();
        }
        let dll = unsafe { LoadLibraryW(w!("ddocr_x86.dll")).unwrap() };
        let init_func = unsafe { GetProcAddress(dll, s!("InitModel")) };
        if init_func.is_none() {
            panic!("获取初始化函数失败！");
        }
        let init_func: extern "system" fn(i32) -> i32 = unsafe { std::mem::transmute(init_func) };
        let identify_func = unsafe {
            let func = GetProcAddress(dll, s!("Identify"));
            if func.is_none() {
                panic!("获取识别函数失败！");
            }
            std::mem::transmute(func)
        };
        let result = init_func(6);
        if result == 0 {
            panic!("初始化失败！");
        }
        Self { dll, identify_func }
    }

    pub fn identify(&self, img_data: &[u8]) -> String {
        let result = self.identify_func.unwrap()(img_data.as_ptr(), img_data.len() as i32);
        let c_str = unsafe { CStr::from_ptr(result as *const _) };
        let text = GBK.decode(c_str.to_bytes(), DecoderTrap::Replace).unwrap();
        text
    }

    pub fn destroy(&self) {
        unsafe { FreeLibrary(self.dll) };
    }
}
