use std::time::Duration;
use tauri::menu::*;
use tauri::tray::*;
use tauri::Manager;
use util::*;
use window_vibrancy::*;
use winreg::enums::*;
use winreg::RegKey;
use winreg::RegValue;

mod util;

#[tauri::command]
async fn kill_game() -> bool {
    let pid = get_procees_by_name("YuanShen.exe").unwrap_or(0);
    if pid > 0 {
        if let Ok(killed) = kill_process(pid) {
            if killed {
                get_game(true).await;
            }
            return killed;
        }
    }
    false
}

#[tauri::command]
fn get_regsk() -> String {
    // 读取注册表
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = "Software\\miHoYo\\原神";
    let value = "MIHOYOSDK_ADL_PROD_CN_h3123967166";
    let sk = hkcu.open_subkey(key);
    if let Ok(sk) = sk {
        let val = sk.get_raw_value(value);
        if let Ok(val) = val {
            return String::from_utf8(val.bytes).unwrap();
        }
    }
    return "".to_string();
}

#[tauri::command]
fn get_uid() -> String {
    // 读取注册表
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = "Software\\miHoYo\\原神";
    let sk = hkcu.open_subkey_with_flags(key, KEY_READ);
    if let Ok(sk) = sk {
        let val = sk
            .enum_values()
            .map(|x| x.unwrap().0)
            .filter(|x| x.starts_with("USD_"));
        for name in val {
            let uid = regex::Regex::new(r"USD_\d\d+").unwrap().find(&name);
            if let Some(uid) = uid {
                // let _ = sk.delete_value(name.clone());
                return uid.as_str()[4..].to_string();
            }
        }
    }
    return "".to_string();
}

#[tauri::command]
fn set_regsk(str: String) {
    // 写入注册表
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = "Software\\miHoYo\\原神";
    let value = "MIHOYOSDK_ADL_PROD_CN_h3123967166";
    let sk = hkcu.open_subkey_with_flags(key, KEY_SET_VALUE | KEY_READ);
    if let Ok(sk) = sk {
        // 删除所有UID缓存
        let val = sk
            .enum_values()
            .map(|x| x.unwrap().0)
            .filter(|x| x.starts_with("USD_"));
        for name in val {
            let uid = regex::Regex::new(r"USD_\d\d+").unwrap().find(&name);
            if let Some(_uid) = uid {
                let _ = sk.delete_value(name.clone());
                println!("Delete UID KEY: {}", name)
                // return uid.as_str()[4..].to_string();
            }
        }

        let val = RegValue {
            vtype: REG_BINARY,
            bytes: str.as_bytes().to_vec(), //str.bytes().chain(std::iter::once(0)).collect(),
        };
        sk.set_raw_value(value, &val).unwrap();
    }
}

// 等待游戏启动状态变化再返回
#[tauri::command]
async fn get_game(is_run: bool) -> bool {
    let mut elapsed = Duration::from_secs(0);
    let timeout = Duration::from_secs(30);
    let interval = Duration::from_millis(500); // 500ms

    while elapsed <= timeout {
        let now_is_run = get_procees_by_name("YuanShen.exe").unwrap_or(0) > 0;
        if now_is_run != is_run {
            return now_is_run;
        }
        tokio::time::sleep(interval).await;
        elapsed += interval;
    }
    is_run
}

#[tauri::command]
fn apply_material(window: tauri::WebviewWindow, material: &str) -> String {
    if material == "Acrylic" && apply_acrylic(&window, Some((0, 0, 0, 0))).is_err() {
        return "Unsupported platform! 'apply_acrylic' is only supported on Windows 10 v1809 or newer"
            .to_string();
    }
    if material == "Mica" && apply_mica(&window, Some(false)).is_err() {
        return "Unsupported platform! 'apply_mica' is only supported on Windows 11".to_string();
    }
    if material == "Mica_Dark" && apply_mica(&window, Some(true)).is_err() {
        return "Unsupported platform! 'apply_mica' is only supported on Windows 11".to_string();
    }
    "Success".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // tauri::async_runtime::set(tokio::runtime::Handle::current());
    tauri::Builder::default()
        // .plugin(tauri_plugin_http::init())
        // .plugin(tauri_plugin_notification::init())
        // .plugin(tauri_plugin_os::init())
        // .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle();
            let window = app.get_webview_window("main").unwrap();
            window.set_shadow(true).expect("Unsupported platform!");

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            #[cfg(target_os = "windows")]
            {
                let acrylic_available = apply_acrylic(&window, Some((0, 0, 0, 0))).is_ok();
                if acrylic_available {
                    println!("Acrylic is available");
                }
            }
            let submenu = SubmenuBuilder::new(handle, "材质")
                .check("Acrylic", "Acrylic")
                .check("Mica", "Mica")
                .check("Mica_Dark", "Mica_Dark")
                .build()?;
            let menu = MenuBuilder::new(app)
                .items(&[&submenu])
                .text("exit", "退出 (&Q)")
                .build()?;

            let set_mat_check = move |x: &str| {
                let _ = submenu
                    .get("Acrylic")
                    .unwrap()
                    .as_check_menuitem()
                    .unwrap()
                    .set_checked(x == "Acrylic");
                let _ = submenu
                    .get("Mica")
                    .unwrap()
                    .as_check_menuitem()
                    .unwrap()
                    .set_checked(x == "Mica");
                let _ = submenu
                    .get("Mica_Dark")
                    .unwrap()
                    .as_check_menuitem()
                    .unwrap()
                    .set_checked(x == "Mica_Dark");
            };
            set_mat_check("Acrylic");

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(move |_app, event| match event.id().as_ref() {
                    "exit" => {
                        std::process::exit(0);
                    }
                    "Acrylic" => {
                        set_mat_check("Acrylic");
                        let _ = apply_material(window.clone(), "Acrylic");
                    }
                    "Mica" => {
                        set_mat_check("Mica");
                        let _ = apply_material(window.clone(), "Mica");
                    }
                    "Mica_Dark" => {
                        set_mat_check("Mica_Dark");
                        let _ = apply_material(window.clone(), "Mica_Dark");
                    }
                    _ => (),
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(webview_window) = app.get_webview_window("main") {
                            if let Ok(is_visible) = webview_window.is_visible() {
                                if is_visible {
                                    let _ = webview_window.hide();
                                } else {
                                    let _ = webview_window.show();
                                    let _ = webview_window.set_focus();
                                }
                            }
                        }
                    }
                })
                .icon(
                    tauri::image::Image::from_bytes(include_bytes!("../icons/icon.ico"))
                        .expect("icon missing"),
                )
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_regsk,
            get_uid,
            set_regsk,
            get_game,
            kill_game,
            apply_material
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use crate::util::get_procees_by_name;

    #[test]
    fn test_get_procees() {
        let rst = get_procees_by_name("YuanShen.exe").unwrap();
        println!("rst: {}", rst);
    }

    #[test]
    fn test_get_regsk() {
        let rst = crate::get_regsk();
        println!("rst: {}", rst);
    }

    #[test]
    fn test_get_uid() {
        let rst = crate::get_uid();
        println!("rst: {}", rst);
    }
}
