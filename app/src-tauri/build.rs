// use tauri_build::{Attributes, WindowsAttributes};

fn main() {
    tauri_build::build();
    // 管理员权限运行
    // 判断是否是debug模式
    // if std::env::var("DEBUG").is_ok() {
    //     tauri_build::build();
    //     return;
    // }
    // let attr = Attributes::new().windows_attributes(
    //     WindowsAttributes::new().app_manifest(include_str!("../../client/misc/app.manifest")),
    // );
    // tauri_build::try_build(attr).expect("failed to run build script");
}
