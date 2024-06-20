use std::time::{Duration, Instant};

use crate::{config::*, game::*, ocr::OCR, util::*};
use console::style;
use image::DynamicImage;
use template_matching::{find_extremes, match_template, MatchTemplateMethod};
use windows::Win32::Foundation::HWND;
#[allow(unused)]
pub struct Cooker {
    pub mon: Box<dyn CookDisplay>,
    pub cfg: Config,
    pub ctl: GameControl,
    pub okimg: image::ImageBuffer<image::Luma<f32>, Vec<f32>>,
    pub ocr: OCR,
    pub state: GameState,
    pub step: Step,
    pub reply_actions: Vec<usize>,
    pub reply_state: ReplyState,
    pub data: CookData,
    pub start_time: Instant,
    pub check_time: Instant,
    pub last_chat_time: Instant,
}
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum GameState {
    Unknown,
    Dead,
    Chat,
    Main,
    Main2p,
    Main1p,
    Confrim,
    Map,
    MapOption,
    Loading,
    F1,
    F2,
    Esc,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Step {
    AutoF2,
    CheckMap,
    AutoReply,
    Finish,
    Exit,
}

pub trait CookDisplay {
    fn on_state_change(&self, state: GameState);
    fn on_step_change(&self, step: Step);
    fn on_pool_full_change(&self, is_full: bool);
    fn log(&self, log: String);
    fn on_success(&self, data: CookData);
    fn on_start(&self);
    fn on_exit(&self);
}

#[derive(Debug, PartialEq, Eq)]
pub enum ReplyState {
    Idle,
    Success,
    Fail,
    Timeout,
}

#[allow(unused, non_snake_case)]
impl<'a> Cooker {
    pub fn new(mon: impl CookDisplay + 'static, cfg: Config, hwnd: HWND) -> Self {
        let cooker = cfg.cooker.clone();
        Self {
            mon: Box::new(mon),
            cfg,
            ctl: GameControl::new(hwnd),
            okimg: image::load_from_memory(include_bytes!("../ok.png"))
                .unwrap()
                .to_luma32f(),
            ocr: OCR::new(),
            state: GameState::Unknown,
            step: Step::AutoReply,
            reply_state: ReplyState::Idle,
            reply_actions: vec![],
            data: CookData::new(cooker.as_str()),
            start_time: Instant::now(),
            check_time: Instant::now().checked_sub(Duration::from_secs(10)).unwrap(),
            last_chat_time: Instant::now(),
        }
    }

    pub fn run(&mut self) {
        self.ctl.focus();
        sleep(100);

        while self.ctl.isForeground() {
            self.state = self.GetState();
            (*self.mon).on_state_change(self.state.clone());
            (*self.mon).on_step_change(self.step.clone());

            self.next();
            sleep(200);
        }
    }

    fn log(&mut self, msg: String) {
        (*self.mon).log(msg);
    }

    pub fn GetState(&self) -> GameState {
        save_dc();
        // self.log(format!("{}", self.ctl.GetColorS(766, 158)));
        if self.ctl.CheckColorS(924, 818, "ECE5D8") && self.ctl.CheckColorS(675, 818, "313131") {
            return GameState::Dead; // 下方复活 真: 死亡界面
        }
        if self.ctl.CheckColorS(876, 633, "4A5366") && self.ctl.CheckColorS(671, 628, "313131") {
            return GameState::Esc; // 旧版本提示 真: 提示界面
        }
        // 左上角返回
        if self.ctl.CheckColorS(32, 47, "ECE5D8") && self.ctl.CheckColorS(35, 35, "3B4255") {
            if self.ctl.CheckColorS(854, 842, "ECE5D8") {
                return GameState::Chat; // 聊天发送按钮 真: 聊天界面
            } else {
                return GameState::Esc;
            }
        }
        if self.ctl.CheckColorS(1391, 193, "D0B8AC|C8B2A5")
            && self.ctl.CheckColorS(766, 158, "E.E.[ED].")
        {
            return GameState::F1; // F1 界面
        }
        if self.ctl.CheckColorS(63, 38, "D3BC8E") && self.ctl.CheckColorS(1537, 54, "ECE5D8") {
            return GameState::F2; // 右上搜索 真: F2 界面
        }
        if self.ctl.CheckColorS(333, 333, "1C1C22|FFFFFF|000000") {
            return GameState::Loading; // 加载界面
        }
        if self.ctl.CheckColorS(305, 51, "9.D720") {
            return GameState::Main2p; // 2p标志
        }
        if self.ctl.CheckColorS(305, 51, "3.D6F.") {
            return GameState::Main1p; // 1p标志 此处标记为
        }
        if self.ctl.CheckColorS(896, 629, "4A5366") {
            return GameState::Confrim; // 确认界面
        }
        if self.ctl.CheckColorS(298, 44, "FFFFFF") {
            return GameState::Main; // 联机标志 真: 单机主界面
        }
        if self.ctl.CheckColorS(45, 848, "ECE5D8") && self.ctl.CheckColorS(51, 847, "3B4255") {
            return GameState::Map; // 左下设置 真: 地图界面
        }
        if self.ctl.CheckColorS(1467, 29, "3D4555") && self.ctl.CheckColorS(1563, 29, "ECE5D8") {
            return GameState::MapOption; // 右上选单 真: 地图界面
        }
        return GameState::Unknown;
    }

    pub fn WaitState(&self, state: GameState, timeout: f64) -> bool {
        let start_time = Instant::now();
        while self.GetState() != state {
            if start_time.elapsed().as_secs_f64() > timeout {
                return false;
            }
            sleep(100);
        }
        return true;
    }

    /// 状态转换函数
    pub fn next(&mut self) {
        match self.state {
            GameState::Unknown => {} // 未知状态 等待
            GameState::Loading => {}
            GameState::Confrim => self.ctl.Click(921, 629), // 确认
            GameState::MapOption => self.ctl.PressKey("esc"),
            GameState::Esc => self.ctl.PressKey("esc"),
            GameState::Dead => self.ctl.Click(924, 818), // 下方复活
            GameState::Chat => {
                if self.step == Step::AutoReply {
                    self.AutoReply();
                } else {
                    self.ctl.PressKey("esc")
                }
            }
            GameState::Main1p => {
                self.ctl.PressKey("f2");
                self.step = Step::Exit;
            }
            GameState::Main2p => match self.step {
                Step::AutoF2 => self.step = Step::CheckMap,
                Step::CheckMap => {
                    if self.cfg.check_map.check {
                        self.ctl.PressKey("f1");
                    } else {
                        self.step = Step::AutoReply;
                    }
                }
                Step::AutoReply => {
                    self.ctl.PressKey("enter");
                    while !self.WaitState(GameState::Chat, 2.0) {
                        self.ctl.PressKey("enter");
                    }
                    let actions = self.cfg.actions.on_enter.clone();
                    self.PlayActions(&actions);
                    self.start_time = Instant::now();
                    self.reply_actions = vec![];
                    self.data = CookData::new(&self.cfg.cooker);
                }
                _ => self.ctl.PressKey("f2"),
            },
            GameState::Main => {
                if self.check_time.elapsed().as_secs() > 5 {
                    let mut count = self.GetCurrentCount();
                    if count >= 3 {
                        (*self.mon).on_pool_full_change(true);
                        while self.ctl.isForeground() && count >= 3 {
                            sleepf(5.0);
                            count = self.GetCurrentCount();
                        }
                        (*self.mon).on_pool_full_change(false);
                    }
                    self.check_time = Instant::now();
                    return;
                }
                self.step = Step::AutoF2;
                self.ctl.PressKey("f2");
                sleep(100);
                self.ctl.MouseMove(5, 5);
            }
            GameState::F1 => self.AutoCheckMap(),
            GameState::F2 => match self.step {
                Step::AutoF2 => {
                    self.AutoF2();
                    self.ctl.PressKey("esc");
                }
                Step::Finish => {
                    self.Publish();
                    self.ctl.Click(5, 5); // 退出
                    sleep(100);
                    self.step = Step::Exit;
                }
                Step::Exit => {
                    self.ctl.Click(1305, 845); // 退出
                }
                _ => self.ctl.PressKey("esc"),
            },
            GameState::Map => {
                if self.step == Step::CheckMap {
                    let rst = self.ctl.CheckColor(1219, 367, "E.E.E.");
                    self.log(format!("{}: {rst}", style("AutoCheckMap").green()));
                    self.step = if rst { Step::AutoReply } else { Step::Exit };
                    if rst {
                        if self.cfg.check_map.teleport {
                            self.ctl.Click(1219, 367);
                            sleepf(self.cfg.check_map.step_delay);
                            self.ctl.Click(1227, 839);
                            sleepf(self.cfg.check_map.step_delay);
                            return;
                        }
                    }
                }
                self.ctl.PressKey("esc")
            }
        }
    }

    // 读取F2界面
    pub fn AutoF2(&self) {
        let mut y_offset = 200; // 292, 200, 356, 220
        if self.cfg.f2.drag {
            self.ctl.MouseMove(1516, 163);
            mouse_down();
            for i in 1..=31 {
                self.ctl.MouseMove(1516, 173 + i * 20); // to 773 30
                sleep(10)
            }
            sleepf(self.cfg.f2.list_delay);
            mouse_up();
            y_offset = 220; // 292, 220, 356, 240
            sleep(100);
        }
        save_dc();
        for i in 0..6 {
            if self.cfg.f2.check_level {
                let level =
                    self.RecognizeText((292, y_offset + 106 * i, 356, 20 + y_offset + 106 * i));
                if !is_match(level.as_str(), self.cfg.f2.level_pattern.as_str()) {
                    continue;
                }
            }
            if self
                .ctl
                .CheckColorS(1353, y_offset - 42 + 104 * i, "3.3.3.")
            {
                self.ctl.Click(1349, y_offset + 106 * i); // 点击申请
                sleepf(self.cfg.f2.list_delay);
            }
        }
        free_dc();
    }

    /// 自动回复
    pub fn AutoReply(&mut self) {
        let replyed = self.data.chat.len() > 0;
        let timeout = (if replyed {
            self.cfg.reply.reply_timeout
        } else {
            self.cfg.reply.timeout
        });
        if self.start_time.elapsed().as_secs_f64() > timeout {
            self.reply_state = ReplyState::Timeout;
            self.step = Step::Finish;
            if replyed {
                self.PlayActions(&self.cfg.actions.on_timeout_reply.clone());
            } else {
                self.PlayActions(&self.cfg.actions.on_timeout_noreply.clone());
            }
            return;
        }
        let mut y = 204;
        let x = 357;
        while y < 730 {
            let rst = self.ctl.PixelSearch((345, y, 351, 759), 0xFFFFFF, 0.03);
            if rst.is_none() {
                break;
            }
            let (_, py) = rst.unwrap();
            // self.log(format!("{}: {}", style("PixelSearch").green(), py));
            // 识别表情
            if self.RecognizeEmo((x, py + 42, x + 50, py + 97)) {
                self.log(format!(
                    "{}: {:?}",
                    style("RecognizeEmo").green(),
                    (x, py + 42, x + 50, py + 97)
                ));
                let mut success_actions = self.cfg.reply.rules.last().unwrap().reactions.clone();

                self.PlayActions(&success_actions);
                self.reply_state = ReplyState::Success;
                self.data.status = "success".to_string();
                self.step = Step::Finish;
                return;
            }
            // 识别文字
            if let Some((px, _)) =
                self.ctl
                    .PixelSearchRev((x, py + 42, x + 490, py + 42 + 32), 0xFFFFFF, 0.03)
            {
                let text = self.RecognizeText((x, py + 42, px + 15, py + 42 + 32));
                if text.len() > 0 && !self.data.chat.contains(&text) {
                    let rules = self
                        .cfg
                        .reply
                        .rules
                        .iter()
                        .position(|rule| is_match(text.as_str(), rule.pattern.as_str()));
                    if rules.is_some() || is_match(text.as_str(), "^[0-9a-zA-Z]{1,4}$") {
                        // 过滤一些置信度比较低的字符
                        self.data.chat.push(text.clone());
                        self.log(format!("{}: {}", style("RecognizeText").green(), text));
                    }
                    if let Some(index) = rules {
                        let rule = &self.cfg.reply.rules[index];
                        if self.reply_actions.contains(&index) {
                            y = py + 119;
                            continue;
                        }
                        self.reply_actions.push(index);
                        match rule.case {
                            Case::Success => {
                                self.reply_state = ReplyState::Success;
                                self.step = Step::Finish;
                                self.data.status = "success".to_string();
                            }
                            Case::Failure => {
                                self.reply_state = ReplyState::Fail;
                                self.step = Step::Finish;
                                self.data.status = "reject".to_string();
                            }
                            Case::Idle => {}
                        }
                        let actions = rule.reactions.clone();
                        self.PlayActions(&actions);
                    }
                }
            }
            y = py + 119
        }
    }

    pub fn PlayActions(&mut self, actions: &Vec<Action>) {
        let time = get_time_str();
        for action in actions.iter() {
            match action {
                Action::Msg(text) => {
                    let text = text.replace("{time}", time.as_str());
                    self.SendChat(text.as_str());
                }
                &Action::Emo(emo) => {
                    self.SendEmo(emo);
                }
                &Action::Delay(delay) => sleepf(delay),
            }
        }
    }

    pub fn SendChat(&mut self, text: &str) {
        self.log(format!("{}: {}", style("SendChat").green(), text));
        if !self.ctl.CheckColor(642, 842, "FFFFFF") {
            self.ctl.PressKey("enter");
            sleep(250)
        }
        while self.last_chat_time.elapsed().as_secs_f64() < 1.0 {
            sleep(100)
        }
        self.ctl.Send(text);
        self.ctl.PressKey("enter");
        sleep(100);
        self.last_chat_time = Instant::now();
    }

    pub fn SendEmo(&mut self, emo: i32) {
        self.log(format!("{}: {}", style("SendEmo").green(), emo));
        if self.ctl.CheckColor(758, 854, "ECE5D8") && self.ctl.CheckColor(758, 846, "3B4255") {
            self.ctl.Click(770, 838);
            sleepf(1.0);
        }
        while self.last_chat_time.elapsed().as_secs_f64() < 1.0 {
            sleep(100);
        }
        let result = self.ctl.PixelSearch((311, 394, 391, 713), 0x3B4354, 0.0);
        if let Some((x, y)) = result {
            let rx = emo % 5;
            let ry = emo / 5;
            self.ctl.Click(x + 135 * rx, y + 166 * ry);
        }
        self.last_chat_time = Instant::now();
        sleepf(0.5);
    }

    pub fn AutoCheckMap(&self) {
        self.ctl.Click(240, 452); // 讨伐;
        sleepf(self.cfg.check_map.step_delay);
        self.ctl.Click(480, 170); // 全部;
        sleepf(self.cfg.check_map.step_delay);
        self.ctl.Click(499, 364); // 首领;
        sleepf(self.cfg.check_map.step_delay);
        self.ctl.Click(797, 693); // 滚动条;
        sleepf(self.cfg.check_map.scroll_delay);
        self.ctl.Click(797, 693); // 滚动条;
        sleepf(self.cfg.check_map.scroll_delay);
        self.ctl.Click(419, 361); // 冰风;
        sleepf(self.cfg.check_map.step_delay);
        self.ctl.Click(1205, 699); // 追踪;
        sleepf(self.cfg.check_map.step_delay);
        self.ctl.Click(1205, 699); // 追踪;
        sleepf(self.cfg.check_map.check_delay);
    }

    /// 识别表情
    pub fn RecognizeEmo(&self, rect: (i32, i32, i32, i32)) -> bool {
        let rect = self.ctl.toScreenRect(rect);
        let img = DynamicImage::ImageRgb8(capture_rect(rect)).to_luma32f();
        let input = template_matching::Image::new(
            self.okimg.to_vec(),
            self.okimg.width(),
            self.okimg.height(),
        );
        let template = template_matching::Image::new(img.to_vec(), img.width(), img.height());
        // 使用模板匹配方法
        let result = match_template(
            input,
            template,
            MatchTemplateMethod::SumOfSquaredDifferences,
        );
        let ext = find_extremes(&result);
        // self.log(format!("{}: {:?}", style("RecognizeEmo").green(), ext));
        ext.min_value < 50.0
    }

    /// 识别文字
    pub fn RecognizeText(&self, rect: (i32, i32, i32, i32)) -> String {
        let rect = self.ctl.toScreenRect(rect);
        let img = capture_rect(rect);
        let dimg = DynamicImage::ImageRgb8(img);
        if let Ok(text) = self.ocr.rec(&dimg) {
            return text;
        } else {
            return "".to_string();
        }
    }

    pub fn SaveBase64Img(&mut self, rect: (i32, i32, i32, i32)) {
        let rect = self.ctl.toScreenRect(rect);
        let img = capture_rect(rect);
        let img_data = img_to_base64(&img);
        self.data.img = img_data.clone();
    }

    /// 上传记录
    pub fn Publish(&mut self) {
        self.ctl.Click(279, 179);
        self.ctl.WaitColor(421, 166, "DAD5CB", 2.0);
        self.ctl.Click(421, 166);
        self.ctl.WaitColor(537, 457, "A7B982", 2.0);
        self.SaveBase64Img((518, 164, 624, 183));
        let uid = self.RecognizeText((518, 164, 624, 183));
        self.data.uid = uid.clone();
        let sign = self.RecognizeText((360, 535, 733, 559));
        self.data.sign = sign.clone();
        let lv = self.RecognizeText((701, 440, 738, 461)).parse();
        if let Ok(lv) = lv {
            self.data.lv = lv;
        }
        self.data.name = self.RecognizeText((461, 377, 623, 409));
        if self.reply_state == ReplyState::Timeout && self.data.chat.len() == 0 {
            if !self.cfg.f2.check_sign || !is_match(&sign, self.cfg.f2.sign_pattern.as_str()) {
                return;
            }
        }

        // 上传数据
        let url = format!("{}new", self.cfg.endpoint);
        (*self.mon).on_success(self.data.clone());
        let json = serde_json::to_string(&self.data).unwrap();
        self.log(format!(
            "{}: {}",
            style("Publish").green(),
            style(&uid).yellow().bold()
        ));
        let result = http_post(&url, &json);
    }

    pub fn GetCurrentCount(&self) -> i32 {
        let url = format!("{}list", self.cfg.endpoint);
        let list = http_get(&url);
        let arr: Vec<&str> = list.split(",").collect();
        // self.log(format!("{}: {:?}", style("GetCurrentCount").green(), arr));
        arr.len() as i32
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct CookData {
    uid: String,
    img: String,
    cooker: String,
    name: String,
    sign: String,
    lv: i32,
    chat: Vec<String>,
    status: String,
    tag: String,
}

impl CookData {
    pub fn new(cooker: &str) -> Self {
        Self {
            uid: String::default(),
            img: String::default(),
            cooker: cooker.to_string(),
            name: String::default(),
            sign: String::default(),
            lv: 0,
            chat: vec![],
            status: "pending".to_string(),
            tag: "auto".to_string(),
        }
    }
}
