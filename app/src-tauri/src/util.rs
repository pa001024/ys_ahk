use std::mem::size_of;

use windows::Win32::{
    Foundation::*,
    System::{
        Diagnostics::ToolHelp::*,
        Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE},
    },
};

#[derive(thiserror::Error, Debug)]
pub enum Win32Error {
    #[error("sys error:`{0}`")]
    Sys(#[from] windows_core::Error),
    #[error("io error:`{0}`")]
    Io(#[from] std::io::Error),
    #[error("custom error:`{0}`")]
    Custom(String),
}

unsafe fn cwstr(p_text: *const u16) -> String {
    let len = (0..).take_while(|&i| *p_text.offset(i) != 0).count();
    let slice = std::slice::from_raw_parts(p_text, len);
    let text = String::from_utf16_lossy(slice);
    text
}

pub(crate) fn get_procees_by_name(name: &str) -> Result<u32, Win32Error> {
    unsafe {
        let mut processes: Vec<PROCESSENTRY32W> = Vec::new();
        let snapshot_handle = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)?;

        if snapshot_handle == INVALID_HANDLE_VALUE {
            return Err(Win32Error::Custom("INVALID_HANDLE_VALUE".to_string()));
        }

        let mut process_entry: PROCESSENTRY32W = PROCESSENTRY32W {
            dwSize: size_of::<PROCESSENTRY32W>() as u32,
            ..PROCESSENTRY32W::default()
        };
        let rst = Process32FirstW(snapshot_handle, &mut process_entry);
        if rst.is_err() {
            CloseHandle(snapshot_handle)?;
            return Err(Win32Error::Sys(rst.unwrap_err()));
        }

        processes.push(process_entry);

        while Process32NextW(snapshot_handle, &mut process_entry).is_ok() {
            processes.push(process_entry);
        }

        CloseHandle(snapshot_handle)?;

        for process in processes {
            let sz_exe_file = cwstr(&process.szExeFile as *const u16);
            if sz_exe_file == name {
                return Ok(process.th32ProcessID);
            }
        }
    }
    return Ok(0);
}

pub(crate) fn kill_process(pid: u32) -> Result<bool, Win32Error> {
    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE, false, pid);
        if handle.is_err() {
            return Err(Win32Error::Sys(windows_core::Error::from_win32()));
        }
        if let Ok(handle) = handle {
            let result = TerminateProcess(handle, 0);
            if result.is_err() {
                return Err(Win32Error::Sys(windows_core::Error::from_win32()));
            }
            let _ = CloseHandle(handle);
            Ok(true)
        } else {
            Ok(false)
        }
    }
}
