use tauri::menu::*;
use tauri::tray::*;
use tauri::Manager;
use tauri_plugin_window_state::{AppHandleExt, StateFlags};
use window_vibrancy::*;

mod services;

// 退出程序
#[tauri::command]
async fn app_close(app_handle: tauri::AppHandle) {
    let Some(window) = app_handle.get_webview_window("main") else {
        return app_handle.exit(0);
    };
    app_handle.save_window_state(StateFlags::all()).ok(); // don't really care if it saves it

    if let Err(_) = window.close() {
        return app_handle.exit(0);
    }
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
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(services::game::init())
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
        .invoke_handler(tauri::generate_handler![apply_material, app_close])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
