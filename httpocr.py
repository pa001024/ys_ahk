# 使用前请输入以下命令安装依赖库 pip install ddddocr cnocr pillow rich flask numpy opencv-python
from flask import Flask, request
import ddddocr
import re
import cv2
from cnocr import CnOcr
from PIL import ImageGrab
from rich.console import Console
import numpy as np

console = Console()

app = Flask(__name__, static_url_path="", static_folder=".")
ocr = ddddocr.DdddOcr(show_ad=False)
numocr = CnOcr(det_model_name="naive_det", rec_model_name="en_PP-OCRv3")
cnocr = CnOcr()

# UID列表
uid_list: list[str] = []


def cors_response(res):
    return app.response_class(response=res, status=200, mimetype="text/plain", headers={"Access-Control-Allow-Origin": "*"})


# 获取UID列表
@app.route("/list", methods=["GET"])
def get_uid_list():
    return cors_response(",".join(uid_list))


# 添加UID
@app.route("/add/<uid>", methods=["GET"])
def add_uid(uid):
    uid_list.append(uid)
    return ",".join(uid_list)


# 删除UID
@app.route("/del/<uid>", methods=["GET"])
def del_uid(uid):
    uid_list.remove(uid)
    return cors_response(",".join(uid_list))


# 文字识别
@app.route("/text", methods=["GET"])
def ocr_text():
    x = request.args.get("x", type=int)
    y = request.args.get("y", type=int)
    w = request.args.get("w", type=int)
    h = request.args.get("h", type=int)
    if x is None or y is None or w is None or h is None:
        return "参数错误"
    bbox = (x, y, x + w, y + h)
    img = ImageGrab.grab(bbox)
    # 转换为cv2图片
    img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

    rst = cnocr.ocr_for_single_line(img)
    if rst.get("score", 0) < 0.8:
        return ""
    text = rst.get("text", "")
    console.log(text)
    return text


# 识别UID
@app.route("/uid", methods=["GET"])
def ocr_uid():
    # 获取请求参数
    x = request.args.get("x", type=int)
    y = request.args.get("y", type=int)
    w = request.args.get("w", type=int)
    h = request.args.get("h", type=int)
    if x is None or y is None or w is None or h is None:
        return "参数错误"
    # 截取指定区域的屏幕
    bbox = (x, y, x + w, y + h)
    img = ImageGrab.grab(bbox)

    # OCR识别
    text = str_filter(ocr.classification(img))

    # 提取识别结果
    if len(text) != 9:
        img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        rst = numocr.ocr_for_single_line(img)
        text = str_filter(rst.get("text", ""))
    console.log(text)
    return text


# handle index.html
@app.route("/", methods=["GET"])
def index():
    return app.send_static_file("index.html")


# 过滤字符串
def str_filter(text):
    text = re.sub(r"[oO]", "0", text)
    text = re.sub(r"[Iil]", "1", text)
    text = re.sub(r",|\.$", "", text)
    text = re.sub(r"[^\d\.]", "", text)
    return text


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8888, debug=False)
