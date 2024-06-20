use crate::ppocr::*;
use image::DynamicImage;
// use imageproc::rect::Rect;

pub struct OCR {
    // det: Det,
    rec: Rec,
}

impl OCR {
    pub fn new() -> Self {
        // let det = Det::from_bytes(include_bytes!("../models/ch_PP-OCRv4_det_infer.onnx")).unwrap();
        let rec = Rec::from_bytes(
            include_bytes!("../models/ch_PP-OCRv4_rec_infer.onnx"),
            include_str!("../models/ppocr_keys_v1.txt"),
        )
        .unwrap();
        Self {
            // det,
            rec,
        }
    }

    // pub fn det(&self, img: &DynamicImage) -> PaddleOcrResult<Vec<Rect>> {
    //     self.det.find_text_rect(img)
    // }

    pub fn rec(&self, img: &DynamicImage) -> PaddleOcrResult<String> {
        self.rec.predict_str(img)
    }
}
