extern crate winres;
use embed_manifest::embed_manifest_file;
fn main() {
    if cfg!(target_os = "windows") {
        let mut res = winres::WindowsResource::new();
        res.set_icon("app.ico");
        res.compile().unwrap();

        // 管理员运行
        embed_manifest_file("misc/app.manifest").expect("can't embed manifest");
    }
}
