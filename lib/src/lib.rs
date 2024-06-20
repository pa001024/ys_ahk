pub mod config;
pub mod cooker;
pub mod game;
pub mod ocr;
pub mod ppocr;
pub mod util;

#[macro_use]
extern crate lazy_static;

#[cfg(test)]
mod tests {
    use super::*;
    use util::is_match;

    #[test]
    fn it_works() {
        let result = is_match("算了吧", "不行|算了");
        assert_eq!(result, true);
    }
}
