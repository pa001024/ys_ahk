use serde::{Deserialize, Serialize};

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Config {
    pub cooker: String,
    pub endpoint: String,
    pub token: String,
    pub reply: ReplyConfig,
    pub actions: ActionsConfig,
    pub check_map: CheckMapConfig,
    pub f2: F2Config,
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct ActionsConfig {
    pub on_enter: Vec<Action>,
    pub on_timeout_reply: Vec<Action>,
    pub on_timeout_noreply: Vec<Action>,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub enum Action {
    Delay(f64),
    Msg(String),
    Emo(i32),
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct CheckMapConfig {
    pub check: bool,
    pub teleport: bool,
    pub f1_delay: f64,
    pub step_delay: f64,
    pub scroll_delay: f64,
    pub check_delay: f64,
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct F2Config {
    pub check_level: bool,
    pub drag: bool,
    pub level_pattern: String,
    pub list_delay: f64,
    pub check_sign: bool,
    pub sign_pattern: String,
}
#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct ReplyConfig {
    pub timeout: f64,
    pub reply_timeout: f64,
    pub rules: Vec<ReplyRule>,
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct ReplyRule {
    pub pattern: String,
    pub reactions: Vec<Action>,
    pub case: Case,
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub enum Case {
    Idle,
    Success,
    Failure,
}

#[allow(unused)]
impl Config {
    pub fn default() -> Self {
        Self {
            cooker: "香菱".to_string(),
            endpoint: "https://xn--chq26veyq.icu/r/default/".to_string(),
            token: "token".to_string(),
            actions: ActionsConfig {
                on_enter: vec![
                    Action::Emo(2),
                    Action::Delay(3.0),
                    Action::Msg("{time}好呀，我有3个朋友想一起打怪，能让他们进来不~~".to_string()),
                ],
                on_timeout_reply: vec![Action::Msg(
                    "_(:з」∠)_我先走了，行的话一会让他们进吧！".to_string(),
                )],
                on_timeout_noreply: vec![Action::Emo(3)],
            },
            reply: ReplyConfig {
                timeout: 30.0,
                reply_timeout: 50.0,
                rules: vec![
                    ReplyRule {
                        pattern: "^(?:我(?:能|可以))?拒绝|机器人|不[好可行能要]|^不打?$|no|shg|珊瑚宫|留着|[4四]连|-6|刚打过了|看下?签名".to_string(),
                        reactions: vec![
                            Action::Msg("打扰了！".to_string())
                        ],
                        case: Case::Failure,
                    },
                    ReplyRule {
                        pattern: "[那哪][三3]?个|说说看|怎么打|材料|几只|什么|多久|啥|[\\?？]$|。。。|\\.\\.\\.".to_string(),
                        reactions: vec![
                            Action::Delay(2.0),
                            Action::Msg("就是枫丹湖中垂柳右边的地方传奇，每天刷新的~~ 2分钟差不多打完了~".to_string())
                        ],
                        case: Case::Idle,
                    },
                    ReplyRule {
                        pattern: "为什么|怎么不|干[嘛吗]".to_string(),
                        reactions: vec![
                            Action::Msg("这怪有几百万血，不过掉的摩拉也多3000摩拉一只，每天最多120W摩拉~".to_string())
                        ],
                        case: Case::Idle,
                    },
                    ReplyRule {
                        pattern: "自己来".to_string(),
                        reactions: vec![
                            Action::Msg("那个, 因为一起申请也不方便呀".to_string())
                        ],
                        case: Case::Idle,
                    },
                    ReplyRule {
                        pattern: "自己世界".to_string(),
                        reactions: vec![
                            Action::Msg("那个, 因为每天要打400个怪，自己世界肯定是不够的呀~~".to_string())
                        ],
                        case: Case::Idle,
                    },
                    ReplyRule {
                        pattern: "帮我|^帮".to_string(),
                        reactions: vec![
                            Action::Msg("要帮忙的话可以让他们帮哦~~".to_string())
                        ],
                        case: Case::Idle,
                    },
                    ReplyRule {
                        pattern: "要帮忙[嘛吗]".to_string(),
                        reactions: vec![
                            Action::Msg("不麻烦你了，让他们自己去吧~~".to_string())
                        ],
                        case: Case::Idle,
                    },
                    ReplyRule {
                        pattern: "^你知道".to_string(),
                        reactions: vec![
                            Action::Msg("我不知道哦~~你可以问问他们".to_string())
                        ],
                        case: Case::Idle,
                    },
                    ReplyRule {
                        pattern: "没开|没解锁".to_string(),
                        reactions: vec![
                            Action::Msg("没事，我看了锚点开了，可以不".to_string())
                        ],
                        case: Case::Idle,
                    },
                    ReplyRule {
                        pattern: "挂\\?|开了|大哥|开挂".to_string(),
                        reactions: vec![
                            Action::Msg("不会哦，你一会可以看展柜".to_string())
                        ],
                        case: Case::Idle,
                    },
                    ReplyRule {
                        pattern: "^[好哦嗯昂可行来进走去肘中]|没事|无所谓|都[行好可]|[好行拉][的把吧啊]|自[便取]|[打请]去?[便打把吧呗]|打$|随[遍便意]|^1+$|冲冲冲|申请|well|go|en|^o$|欧克|阔以|可以|彳[亍于]|ok|^hao|^keyi|^ky|^qu|^zou|一起|没有?问题|当然|欢迎|天经地义".to_string(),
                        reactions: vec![
                            Action::Msg("好的，我先走了，我朋友等会过来~~ 人多容易卡最好开个自动 谢谢老板~~".to_string()),
                            Action::Emo(1),
                        ],
                        case: Case::Success,
                    },
                ],
            },
            check_map: CheckMapConfig {
                check: true,
                teleport: false,
                f1_delay: 2.0,
                step_delay: 0.2,
                scroll_delay: 0.5,
                check_delay: 0.5,
            },
            f2: F2Config {
                check_level: false,
                drag: false,
                level_pattern: "3[0-9]".to_string(),
                list_delay: 0.03,
                check_sign: true,
                sign_pattern: "挂机|自取|随意".to_string(),
            },
        }
    }

    pub fn to_string(&self) -> String {
        serde_yaml::to_string(&self).unwrap()
    }

    pub fn from_string(s: &str) -> Self {
        serde_yaml::from_str(s).unwrap()
    }

    pub fn from_file(path: &str) -> Self {
        let rst = std::fs::read_to_string(path);
        if rst.is_err() {
            let cfg = Config::default();
            cfg.to_file(path);
            return cfg;
        }
        let s = rst.unwrap();
        let config = serde_yaml::from_str(&s);
        if config.is_err() {
            println!("配置文件格式错误，使用默认配置: {}", config.err().unwrap());
            return Config::default();
        }
        config.unwrap()
    }

    pub fn to_file(&self, path: &str) {
        let s = serde_yaml::to_string(&self).unwrap();
        std::fs::write(path, s).unwrap();
    }
}
