mod config;
mod cooker;
mod game;
mod ocr;
mod ppocr;
mod util;
use crate::config::Config;
use crate::cooker::Cooker;
use crate::util::*;
use console::style;
#[macro_use]
extern crate lazy_static;

// cargo run --target i686-pc-windows-msvc
fn main() -> Result<(), std::io::Error> {
    let console = console::Term::stdout();
    // console.clear_screen()?;
    console.set_title("做饭姬");
    println!(
        "{} ver: {}",
        style("做饭姬").green().bold(),
        style(env!("CARGO_PKG_VERSION")).blue().bold()
    );

    // 加载配置文件
    let cfg = Config::from_file("config.yml");

    // 获取游戏窗口句柄
    let hwnd = find_window(None, Some("原神"));
    if let Some(hwnd) = hwnd {
        // 实例化游戏控制对象
        let mut cooker = Cooker::new(&console, cfg, hwnd);
        cooker.run();
        println!("{} 自动退出", style("切换窗口").red());
        Ok(())
    } else {
        println!(
            "未找到原神窗口 请把游戏窗口分辨率调整到{}后运行本程序",
            style("1600x900").green().bold()
        );
        Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "find_window failed",
        ))
    }
}
