use std::{ffi::c_void, mem::size_of, thread::sleep, time::Duration};

use windows::{
    core::PCWSTR,
    Win32::{
        Foundation::*,
        System::{
            Diagnostics::{Debug::*, ToolHelp::*},
            Memory::*,
            ProcessStatus::*,
            SystemServices::IMAGE_DOS_HEADER,
            Threading::*,
        },
        UI::{Shell::*, WindowsAndMessaging::*},
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

unsafe fn cstr(p_text: *const u8) -> String {
    let len = (0..).take_while(|&i| *p_text.offset(i) != 0).count();
    let slice = std::slice::from_raw_parts(p_text, len);
    let text = String::from_utf8_lossy(slice);
    text.to_string()
}

pub fn str_to_pcwstr(s: &str) -> PCWSTR {
    PCWSTR::from_raw(widestring::U16CString::from_str(s).unwrap().into_raw())
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

pub fn shell_execute(
    lp_file: &str,
    lp_parameters: Option<&str>,
    lp_directory: Option<&str>,
) -> Result<SHELLEXECUTEINFOW, Win32Error> {
    unsafe {
        let file = str_to_pcwstr(lp_file);
        let parameters = lp_parameters.map_or(PCWSTR::null(), |p| str_to_pcwstr(p));
        let directory = lp_directory.map_or(PCWSTR::null(), |d| str_to_pcwstr(d));
        let mut pc: SHELLEXECUTEINFOW = std::mem::zeroed();
        pc.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        pc.lpVerb = str_to_pcwstr("runas");
        pc.lpFile = file;
        pc.lpDirectory = directory;
        pc.lpParameters = parameters;
        pc.nShow = SW_SHOWNORMAL.0;
        pc.fMask = SEE_MASK_FLAG_NO_UI | SEE_MASK_NOCLOSEPROCESS;
        let _ = ShellExecuteExW(&mut pc)?;
        // let _ = CloseHandle(pc.hProcess);
        // loop {
        println!("ShellExecuteW: {}", pc.hProcess.0);
        //     sleep(Duration::from_millis(500));
        //     if pc.hProcess.0 != 0 {
        //         break;
        //     }
        // }
        Ok(pc)
    }
}

pub(crate) fn get_module_by_name(
    hprocess: HANDLE,
    module_name: &str,
) -> Result<MODULEENTRY32, Win32Error> {
    let mut h_module: MODULEENTRY32 = MODULEENTRY32::default();

    'out: for _ in 0..50 {
        unsafe {
            let mut modules: Vec<HMODULE> = Vec::with_capacity(1024);
            modules.resize(1024, HMODULE::default());
            let mut cb_needed = 0;

            if let Ok(_) = EnumProcessModules(
                hprocess,
                modules.as_mut_ptr(),
                (modules.len() * size_of::<HMODULE>()) as u32,
                &mut cb_needed,
            ) {
                modules.resize(
                    cb_needed as usize / size_of::<HMODULE>(),
                    HMODULE::default(),
                );
                for it in modules {
                    let mut sz_module_name = [0; MAX_PATH as usize];
                    if GetModuleBaseNameA(hprocess, it, &mut sz_module_name) == 0 {
                        continue;
                    }
                    if module_name != cstr(sz_module_name.as_ptr()) {
                        continue;
                    }
                    let mut mod_info = MODULEINFO::default();
                    if GetModuleInformation(
                        hprocess,
                        it,
                        &mut mod_info,
                        size_of::<MODULEINFO>() as u32,
                    )
                    .is_err()
                    {
                        continue;
                    }

                    h_module.modBaseAddr = mod_info.lpBaseOfDll as *mut u8;
                    h_module.modBaseSize = mod_info.SizeOfImage;
                    break 'out;
                }
            }

            sleep(Duration::from_millis(200));
        }
    }

    Ok(h_module)
}

pub(crate) fn get_memory_by_pattern(
    hprocess: HANDLE,
    lpbaseaddress: *const c_void,
    dwsize: usize,
    pattern: &str,
    offset: usize,
) -> Result<*const c_void, Win32Error> {
    unsafe {
        let up = VirtualAlloc(None, dwsize, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);

        if up.is_null() {
            return Err(Win32Error::Sys(windows_core::Error::from_win32()));
        }

        // 把整个模块读出来
        let _ = ReadProcessMemory(hprocess, lpbaseaddress, up, dwsize, None)?;
        let address = pattern_scan(up, pattern); // ver 3.7 - last
        if address.is_null() {
            return Err(Win32Error::Custom("outdated pattern".to_string()));
        }

        println!("Pattern found at: {:p}", address);

        // 计算相对地址 (FPS)
        let pfps = {
            let mut rip = address as usize;
            println!("RIP: {:x}", rip);
            rip = rip.wrapping_add(3);
            println!("RIP: {:x} {}", rip, *(rip as *const i32));
            rip = rip.wrapping_add(std::ptr::read_unaligned(rip as *const i32) as usize + 6);
            println!("RIP: {:x} {}", rip, *(rip as *const i32));
            rip = rip.wrapping_add(std::ptr::read_unaligned(rip as *const i32) as usize + 4);
            println!("RIP: {:x} {:p}", rip, up);
            rip - up as usize + offset
        } as *const c_void;
        println!("pfps: {:p}", pfps);

        let _ = VirtualFree(up, 0, MEM_RELEASE)?;

        return Ok(pfps);
    }
}

pub(crate) fn write_memory_until_exit(hprocess: HANDLE, pfps: *const c_void, target_fps: isize) {
    unsafe {
        let mut dw_exit_code = STILL_ACTIVE.0 as u32;
        while dw_exit_code == STILL_ACTIVE.0 as u32 {
            let _ = GetExitCodeProcess(hprocess, &mut dw_exit_code);
            sleep(std::time::Duration::from_millis(2000));

            let mut fps = 0isize;
            if let Err(err) = ReadProcessMemory(
                hprocess,
                pfps,
                &mut fps as *mut isize as *mut c_void,
                size_of::<usize>(),
                None,
            ) {
                eprintln!("ReadProcessMemory error: {}", err);
            }
            if fps == -1 {
                continue;
            }
            if fps != target_fps {
                if let Err(_) = WriteProcessMemory(
                    hprocess,
                    pfps,
                    &target_fps as *const isize as *const c_void,
                    size_of::<isize>(),
                    None,
                ) {
                    // eprintln!("WriteProcessMemory error: {}", err);
                }
                // println!("FPS: {}", fps);
            }
        }
        // exit
        let _ = CloseHandle(hprocess);
    }
}

fn pattern_to_byte(pattern: &str) -> Vec<i16> {
    let mut bytes = Vec::new();
    for chunk in pattern.split_whitespace() {
        if chunk == "??" {
            bytes.push(-1); // 将 "??" 转换为 0
        } else {
            match i16::from_str_radix(chunk, 16) {
                Ok(byte) => bytes.push(byte),
                Err(_) => {
                    eprintln!("Invalid hex byte: {}", chunk);
                    return Vec::new();
                }
            }
        }
    }
    bytes
}

unsafe fn pattern_scan(module: *const c_void, signature: &str) -> *const c_void {
    let dos_header = module.cast::<IMAGE_DOS_HEADER>();
    let nt_headers = module
        .add((*dos_header).e_lfanew as usize)
        .cast::<IMAGE_NT_HEADERS64>();

    let size_of_image = (*nt_headers).OptionalHeader.SizeOfImage;
    let pattern_bytes = pattern_to_byte(signature);
    let scan_bytes = module;

    let s = pattern_bytes.len();
    let d = pattern_bytes.as_slice();

    for i in 0..size_of_image as usize - s {
        let mut found = true;
        for j in 0..s {
            if *(scan_bytes.add(i + j).cast::<u8>()) != d[j] as u8 && *d.get_unchecked(j) != -1i16 {
                found = false;
                break;
            }
        }
        if found {
            return scan_bytes.add(i);
        }
    }
    std::ptr::null()
}
