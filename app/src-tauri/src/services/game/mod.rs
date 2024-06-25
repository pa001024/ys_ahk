use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};
use winreg::{enums::*, RegKey, RegValue};

use self::util::{get_procees_by_name, kill_process};
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

#[derive(Serialize, Deserialize)]
struct UIDCache {
    uid: String,
    usk: String,
    usd: String,
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
            .map(|x| x.unwrap())
            .filter(|x| x.0.starts_with("USD_"));
        for (name, value) in val {
            let uid: Option<regex::Match> = regex::Regex::new(r"USD_\d\d+").unwrap().find(&name);

            if let Some(uid) = uid {
                let usd = value.to_string();
                let cache = UIDCache {
                    uid: uid.as_str()[4..].to_string(),
                    usk: name,
                    usd,
                };
                return serde_json::to_string(&cache).unwrap();
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

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("game")
        .invoke_handler(tauri::generate_handler![
            get_regsk, get_uid, set_regsk, get_game, kill_game,
        ])
        .build()
}

#[cfg(test)]
mod tests {
    use super::{get_procees_by_name, get_regsk, get_uid};

    #[test]
    fn test_get_procees() {
        let rst = get_procees_by_name("YuanShen.exe").unwrap();
        println!("rst: {}", rst);
    }

    #[test]
    fn test_get_regsk() {
        let rst = get_regsk();
        println!("rst: {}", rst);
    }

    #[test]
    fn test_get_uid() {
        let rst = get_uid();
        println!("rst: {}", rst);
    }
}
