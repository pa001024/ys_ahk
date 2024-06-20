extern crate lib;
use console::{style, Term};
use indicatif::{MultiProgress, ProgressBar};
use lib::config::Config;
use lib::cooker::{CookDisplay, Cooker};
use lib::util::*;
use std::time::Duration;

struct ConsoleDisplay {
    pub bars: MultiProgress,
    state_bar: ProgressBar,
    step_bar: ProgressBar,
    full_bar: ProgressBar,
}

impl ConsoleDisplay {
    fn new() -> Self {
        let bars = MultiProgress::new();
        let state_bar = bars.add(ProgressBar::new_spinner());
        let step_bar = bars.add(ProgressBar::new_spinner());
        let full_bar = bars.add(ProgressBar::new_spinner());
        Self {
            bars,
            state_bar,
            step_bar,
            full_bar,
        }
    }
}

impl CookDisplay for ConsoleDisplay {
    fn on_state_change(&self, state: lib::cooker::GameState) {
        self.state_bar
            .set_message(format!("{}: {:?}", style("State:").blue(), state));
    }

    fn on_step_change(&self, step: lib::cooker::Step) {
        self.step_bar
            .set_message(format!("{}: {:?}", style("Step:").blue(), step));
    }

    fn on_pool_full_change(&self, is_full: bool) {
        if is_full {
            self.bars.add(self.full_bar.clone());
            self.full_bar.enable_steady_tick(Duration::from_millis(200));
            self.full_bar
                .set_message(format!("{}", style("UID池已满 等待中...").red()));
        } else {
            self.bars.remove(&self.full_bar);
        }
    }

    fn log(&self, msg: String) {
        use chrono::{Local, NaiveTime};
        let now = Local::now();
        let time = NaiveTime::from(now.time());
        let timestamp = style(time.format("[%H:%M:%S]").to_string()).cyan();
        let _ = self.bars.println(format!("{timestamp} {msg}"));
    }

    fn on_start(&self) {
        self.state_bar
            .enable_steady_tick(Duration::from_millis(200));
        self.step_bar.enable_steady_tick(Duration::from_millis(200));
    }

    fn on_success(&self, _data: lib::cooker::CookData) {
        // self.log()
    }

    fn on_exit(&self) {
        self.state_bar.finish();
        self.step_bar.finish();
    }
}

fn main() -> Result<(), std::io::Error> {
    let console = Term::stdout();
    console.set_title(format!("做饭姬 v{}", env!("CARGO_PKG_VERSION")));
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
        let mon = ConsoleDisplay::new();
        // 实例化游戏控制对象
        let mut cooker = Cooker::new(mon, cfg, hwnd);
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
