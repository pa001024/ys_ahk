import datetime
import re
import pyautogui as pg
import time
import cv2
from cnocr import CnOcr
from PIL import ImageGrab
import numpy as np
import requests
import win32gui as wg
from rich.console import Console
from pynput.mouse import Button, Controller
import pyperclip
import configparser

console = Console()
numocr = CnOcr(det_model_name="naive_det", rec_model_name="en_PP-OCRv3")
cnocr = CnOcr()

# 读取配置文件
config = configparser.ConfigParser()
config.read("autocook.ini", encoding="utf-8")

cfg_endpoint = config.get("cook", "endpoint")
cfg_checkmap = config.getint("cook", "checkmap")
cfg_entermsg = config.get("cook", "entermsg")
cfg_enteremo = config.getint("cook", "enteremo")
cfg_successmsg = config.get("cook", "successmsg")
cfg_successemo = config.getint("cook", "successemo")
cfg_exitmsg = config.get("cook", "exitmsg")
cfg_exitemo = config.getint("cook", "exitemo")
cfg_timeout = config.getint("cook", "timeout")
cfg_timeoutmsg = config.get("cook", "timeoutmsg")
cfg_timeoutemo = config.getint("cook", "timeoutemo")


# 识别数字
def OCRNumber(region):
    img = ImageGrab.grab(region)
    gray = cv2.cvtColor(np.array(img), cv2.COLOR_BGR2GRAY)
    (_, bin) = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
    rst = numocr.ocr_for_single_line(bin)
    return num_filter(rst.get("text", ""))


def num_filter(text):
    text = re.sub(r"[oO]", "0", text)
    text = re.sub(r"[Iil]", "1", text)
    text = re.sub(r",|\.$", "", text)
    text = re.sub(r"[^\d\.]", "", text)
    return text


# 获取窗口位置
def GetWindowPos(hwnd):
    rect = wg.GetClientRect(hwnd)
    x, y = wg.ClientToScreen(hwnd, (0, 0))
    rect = (x, y, rect[2] + x, rect[3] + y)
    return rect


def get_pixel_color(x, y):
    c = pg.pixel(x, y)
    hex_str = "{:02X}{:02X}{:02X}".format(c[0], c[1], c[2])
    return hex_str


def getTimeStr():
    now = datetime.datetime.now()
    if now.hour < 5:
        return "晚上"
    elif now.hour < 9:
        return "早上"
    elif now.hour < 11:
        return "上午"
    elif now.hour < 14:
        return "中午"
    elif now.hour < 17:
        return "下午"
    else:
        return "晚上"


mouse = Controller()


class GameControl:
    def __init__(self, hwnd):
        self.hwnd = hwnd
        rect = wg.GetClientRect(hwnd)
        x, y = wg.ClientToScreen(hwnd, (0, 0))
        w, h = rect[2], rect[3]
        console.log(f"原神窗口位置：{x},{y},{w},{h}")
        self.x = x  # 窗口左上角x坐标
        self.y = y  # 窗口左上角y坐标
        self.w = w  # 窗口宽度
        self.h = h  # 窗口高度

    def isForeground(self):
        return self.hwnd == wg.GetForegroundWindow()

    def toScreenPos(self, x, y):
        cx, cy = wg.ClientToScreen(self.hwnd, (x, y))
        return (cx * self.w // 1600), (cy * self.h // 900)

    def Click(self, x, y, count=1):
        mouse.position = self.toScreenPos(x, y)
        if count > 0:
            mouse.click(Button.left, count)

    def Drag(self, x1, y1, x2, y2, step=1, interval=0.001):
        mouse.position = self.toScreenPos(x1, y1)
        mouse.press(Button.left)
        self.MoveTo(x1, y1, x2, y2, step, interval)
        mouse.release(Button.left)

    def MoveTo(self, x1, y1, x2, y2, step=1, interval=0.001):
        mouse.position = self.toScreenPos(x1, y1)
        (x, y) = self.toScreenPos(x2, y2)
        while mouse.position[0] != x or mouse.position[1] != y:
            mouse.move(
                0 if abs(mouse.position[0] - x) < step else step if mouse.position[0] < x else -step,
                0 if abs(mouse.position[1] - y) < step else step if mouse.position[1] < y else -step,
            )
            if abs(mouse.position[0] - x) < step and abs(mouse.position[1] - y) < step:
                mouse.position = (x, y)
            time.sleep(interval)

    def CheckColorS(self, screen, x, y, color):
        p = screen.getpixel(self.toScreenPos(x, y))
        hex_str = "{:02X}{:02X}{:02X}".format(p[0], p[1], p[2])
        return re.match(color, hex_str) is not None

    def CheckColor(self, x, y, color):
        return re.match(color, get_pixel_color(*self.toScreenPos(x, y))) is not None

    # 等待颜色
    def WaitColor(self, x, y, color, timeout=10, interval=0.1):
        start_time = time.time()
        while not self.CheckColor(x, y, color):
            time.sleep(interval)
            if time.time() - start_time > timeout:
                return False
        return True

    def PixelSearch(self, x1, y1, x2, y2, color, threshold=0.0):
        screen = ImageGrab.grab()
        img = np.array(screen)
        self.x, self.y = self.toScreenPos(0, 0)
        for iy in range(y1, y2):
            for ix in range(x1, x2):
                p = img[iy + self.y, ix + self.x]
                if abs(p[0] - color[0]) <= threshold * 255 and abs(p[1] - color[1]) <= threshold * 255 and abs(p[2] - color[2]) <= threshold * 255:
                    return ix, iy
        return None, None

    def PixelSearchImg(self, img, x1, y1, x2, y2, color, threshold=0.0):
        for iy in range(y1, y2):
            for ix in range(x1, x2):
                p = img[iy, ix]
                if abs(p[0] - color[0]) <= threshold * 255 and abs(p[1] - color[1]) <= threshold * 255 and abs(p[2] - color[2]) <= threshold * 255:
                    return ix, iy
        return None, None

    def PixelSearchImgFromEnd(self, img, x1, y1, x2, y2, color, threshold=0.0):
        for ix in range(x2 - 1, x1 - 1, -1):
            for iy in range(y2 - 1, y1 - 1, -1):
                p = img[iy, ix]
                if abs(p[0] - color[0]) <= threshold * 255 and abs(p[1] - color[1]) <= threshold * 255 and abs(p[2] - color[2]) <= threshold * 255:
                    return ix, iy
        return None, None

    def SendText(self, text):
        bak = pyperclip.paste()
        pyperclip.copy(text)
        pg.hotkey("ctrl", "v")
        time.sleep(0.1)
        pyperclip.copy(bak)

    def GetState(self):
        if self.CheckColor(924, 818, "ECE5D8") and self.CheckColor(675, 818, "313131"):  # 下方复活 真: 死亡界面
            return "dead"
        if self.CheckColor(32, 47, "ECE5D8") and self.CheckColor(35, 35, "3B4255"):
            if self.CheckColor(854, 842, "ECE5D8"):  # 聊天发送按钮 真: 聊天界面
                return "chat"
            elif self.CheckColor(37, 91, "4A5366"):  # 左上返回 真: ESC 界面
                return "esc"
            elif self.CheckColor(41, 846, "DACEB7"):  # 左下加号 真: 聊天界面
                return "esc"
            else:
                return "esc"
        if self.CheckColor(63, 38, "D3BC8E") and self.CheckColor(1537, 54, "ECE5D8"):  # 右上搜索 真: F2 界面
            return "f2"
        if self.CheckColor(333, 333, "1C1C22|FFFFFF|000000"):  # 加载界面
            return "loading"
        if self.CheckColor(305, 50, "9.D720"):  # 联机标志 真: 联机主界面
            return "main"
        if self.CheckColor(298, 44, "FFFFFF"):  # 联机标志 真: 单机主界面
            return "main"
        if self.CheckColor(45, 848, "ECE5D8") and self.CheckColor(51, 847, "3B4255"):  # 左下设置 真: 地图界面
            return "map"
        if self.CheckColor(1467, 29, "3D4555") and self.CheckColor(1563, 29, "ECE5D8"):  # 右上选单 真: 地图界面
            return "map_option"
        return "unknown"

    def is2p(self):
        return self.CheckColor(305, 50, "9.D720")

    def ispchat(self):
        return self.CheckColor(950, 25, "ECE5D8")

    def GetStateDebug(self):
        state = self.GetState()
        console.log(f"[blue]GetState[white]-当前状态：{state}")
        return state

    def WaitState(self, states: list[str] | str, timeout=15.0):
        start_time = time.time()
        current_state = self.GetState()
        while not (any(state == current_state for state in states) if isinstance(states, list) else current_state == states):
            time.sleep(0.1)
            current_state = self.GetState()

            if time.time() - start_time > timeout:
                return False
        return True

    def EnterMain(self, timeout=15.0):
        # console.log("[gray]EnterMain")
        start_time = time.time()
        while self.isForeground():
            state = self.GetState()
            if state == "dead":
                self.Click(924, 818)
                if self.WaitState("main"):
                    return True
            if state == "chat" or state == "map" or state == "f2" or state == "esc":
                pg.press("esc")
                if self.WaitState("main"):
                    return True
            if state == "loading":
                if self.WaitState("main"):
                    return True
            if state == "main":
                return True
            if state == "map_option":
                pg.press("esc")
                time.sleep(0.1)
                pg.press("esc")
                if self.WaitState("main"):
                    return True

            if time.time() - start_time > timeout:
                return False
            time.sleep(0.1)
        raise SystemExit("切换窗口 停止操作")

    def EnterChat(self, timeout=10.0):
        # console.log("[gray]EnterChat")
        start_time = time.time()
        while self.isForeground():
            state = self.GetState()
            if time.time() - start_time > timeout:
                return False
            if state == "main":
                pg.press("enter")
                if self.WaitState("chat", 1):
                    return True
            elif state == "pchat":
                self.Click(173, 117)
                self.WaitState("chat", 1)
                return True
            elif state == "chat":
                return True
            elif state == "unknown":
                time.sleep(0.1)
                continue
            else:
                self.EnterMain()
            time.sleep(0.1)
        raise SystemExit("切换窗口 停止操作")

    def EnterMap(self, timeout=10.0):
        # console.log("[gray]EnterMap")
        start_time = time.time()
        while self.isForeground():
            state = self.GetState()
            if time.time() - start_time > timeout:
                return False
            if state == "main":
                pg.press("m")
                if self.WaitState("map", 1):
                    return True
            elif state == "map":
                return True
            elif state == "map_option":
                pg.press("esc")
                if self.WaitState("map", 1):
                    return True
            elif state == "unknown":
                if time.time() - start_time > 3:
                    pg.press("esc")
                time.sleep(0.1)
                continue
            else:
                self.EnterMain()
            time.sleep(0.1)
        raise SystemExit("切换窗口 停止操作")

    def EnterF2(self, timeout=10.0):
        # console.log("[gray]EnterF2")
        start_time = time.time()
        while self.isForeground():
            state = self.GetState()
            if time.time() - start_time > timeout:
                return False
            if state == "main":
                pg.press("f2")
                if self.WaitState("f2", 1):
                    return True
            elif state == "f2":
                return True
            elif state == "unknown":
                time.sleep(0.1)
                continue
            else:
                self.EnterMain()
            time.sleep(0.1)
        raise SystemExit("切换窗口 停止操作")

    last_chat_time = 0

    def AutoChat(self, text, auto_exit=True, timeout=10.0):
        console.log(f"[blue]AutoChat: [green]{text}")
        if self.GetState() != "chat" and not self.EnterChat(timeout):
            return False
        if not self.CheckColor(642, 842, "FFFFFF"):
            pg.press("enter")
            time.sleep(0.25)
        self.SendText(text)
        pg.press("enter")
        while time.time() - self.last_chat_time < 1 and self.isForeground():
            time.sleep(0.1)
        self.last_chat_time = time.time()
        if auto_exit:
            pg.press("esc")
            time.sleep(0.3)
        return True

    def AutoEmo(self, index, auto_exit=True, timeout=10.0):
        console.log(f"[blue]AutoEmo: [green]{index}")
        if not self.EnterChat(timeout):
            return False
        if self.CheckColor(758, 854, "ECE5D8") and self.CheckColor(758, 846, "3B4255"):
            self.Click(770, 838)
            time.sleep(1.5)
        rst = self.PixelSearch(311, 394, 391, 713, (0x3B, 0x43, 0x54))
        if rst[0] is not None:
            rx = index % 5
            ry = index // 5
            self.Click(rst[0] + 135 * rx, rst[1] + 166 * ry)
        while time.time() - self.last_chat_time < 1 and self.isForeground():
            time.sleep(0.1)
        self.last_chat_time = time.time()
        if auto_exit:
            pg.press("esc")
            time.sleep(0.3)
        return True

    def AutoF2(self):
        with console.status("[red]AutoF2"):
            while self.isForeground() and not self.CheckColor(333, 333, "1C1C22|FFFFFF"):
                if self.GetState() == "loading":
                    return True
                elif self.GetState() == "main" and self.is2p():
                    return True
                if not self.EnterF2(3):
                    return True
                screen = ImageGrab.grab()
                for i in range(1, 7):
                    if self.CheckColorS(screen, 1352, 158 + 104 * (i - 1), "3.3.3."):
                        self.Click(1349, 197 + 104 * (i - 1))
                        time.sleep(0.01)
                pg.press("esc")
                time.sleep(0.1)

    def AutoCheckMap(self, teleport=False):
        with console.status("[red]AutoCheckMap"):
            self.EnterMap()
            self.Click(1532, 846)
            time.sleep(0.2)
            self.Click(1272, 327)
            self.WaitState("map")
            for _ in range(100):
                mouse.scroll(0, 1)
            for _ in range(3):
                self.Click(39, 545)
                time.sleep(0.02)
            time.sleep(0.3)
            for _ in range(4):
                mouse.scroll(0, -1)
                time.sleep(0.2)
            (x, y) = self.PixelSearch(1438, 381, 1492, 432, (0xBA, 0xBA, 0xBC), 0.04)
            if teleport and x is not None:
                self.Click(x, y)
                self.WaitColor(1080, 618, "FFFFFF")
                self.Click(1080, 610)
                time.sleep(0.3)
                self.Click(1227, 839)
                time.sleep(0.2)
        console.log(f"[green]AutoCheckMap: [green]{x is not None}")
        return x is not None

    def AutoExit(self):
        console.log("[red]AutoExit")
        self.EnterF2()
        if self.WaitColor(1305, 845, "ECE5D8"):
            self.Click(1305, 845)

    replyGroups = [
        [r"^不$|不行|不可以|不能|no|shg|珊瑚宫|留着|四连|-6|刚打过了", cfg_exitmsg, "exit"],
        [
            r"^[好哦嗯可行来进走去]|好[的把吧啊]|自[便取]|[打请][便打把吧呗]|打$|随[便意]|^1|冲冲冲|申请|good|欧克|阔以|可以|彳[亍于]|ok|^hao|keyi|ky|一起|没问题|当然|欢迎",
            cfg_successmsg,
            "success",
        ],
        [r"怎么打|材料|几只|什么|啥|哪个|那个|^[\?？]|。。。|\.\.\.", "就是枫丹湖中垂柳右边的地方传奇，每天刷新的~~ 2分钟差不多打完了~", "idle"],
        [r"为什么|怎么不|干[嘛吗]", "这怪有几百万血，不过掉的摩拉也多3000摩拉一只，每天最多120W摩拉~", "idle"],
        [r"帮我|^帮", "要帮忙的话可以让他们帮哦~~", "idle"],
        [r"要帮忙[嘛吗]", "不麻烦你了，让他们自己去吧~~", "idle"],
        [r"^你知道", "我不知道哦~~你可以问问他们", "idle"],
        [r"没开|没解锁", "没事的，锚点开了就行", "idle"],
        [r"挂\?|开了|大哥|开挂", "不会哦，你一会可以看展柜", "idle"],
        [r"你朋友", "嗯啊我来探路", "idle"],
        # [r"核爆", "打点摩拉而已", "idle"],
    ]

    inputSet = set()
    replySet = set()
    okimg = cv2.imread("ok.png")

    def RecognizeEmo(self, img):
        emoimg = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        res = cv2.matchTemplate(self.okimg, emoimg, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)
        return max_val > 0.8

    def RecognizeText(self, img):
        # 预处理
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        mask = cv2.threshold(gray, 146, 255, cv2.THRESH_BINARY)[1]
        ret = cv2.bitwise_and(gray, gray, mask=mask)
        rst = cnocr.ocr_for_single_line(ret)
        if rst and rst.get("score", 0) > 0.3:
            text = rst.get("text", "")
            return text
        return ""

    def AutoReply(self):
        if self.GetState() == "loading":
            return True
        if self.GetState() != "chat" and not self.EnterChat():
            return False
        if self.GetState() == "main" and not self.is2p():
            return True
        self.x, self.y = self.toScreenPos(0, 0)
        img = ImageGrab.grab((self.x, self.y, self.x + self.w, self.y + self.h))
        img = np.array(img)
        y = 204
        x = 357
        while y < 730:
            (_, Py) = self.PixelSearchImg(img, 345, y, 351, 759, (0xFF, 0xFF, 0xFF), 0.03)
            if Py is None:
                break
            # 识别表情
            if self.RecognizeEmo(img[Py + 42 : Py + 42 + 55, x : x + 50]):
                console.log(f"[green]RecognizeEmo [green]({Py})")
                if cfg_successmsg:
                    self.AutoChat(cfg_successmsg, auto_exit=False)
                if cfg_successemo:
                    self.AutoEmo(cfg_successemo, auto_exit=False)
                self.UploadUID()
                self.AutoExit()
                return True
            # 识别文字
            (Px, _) = self.PixelSearchImgFromEnd(img, x, Py + 42, x + 490, Py + 42 + 32, (0xFF, 0xFF, 0xFF), 0.03)
            if Px is None:
                y = Py + 119
                continue
            text = self.RecognizeText(img[Py + 42 : Py + 42 + 32, x : Px + 15])
            if text:
                if text in self.inputSet:
                    y = Py + 119
                    continue
                self.inputSet.add(text)
                console.log(f"[green]RecognizeText [green]({x},{y}): {text}")
                for pattern, reply, action in self.replyGroups:
                    if re.search(pattern, text, re.IGNORECASE):
                        if reply in self.replySet:
                            continue
                        self.replySet.add(reply)
                        time.sleep(2)
                        if action == "exit":
                            if cfg_exitmsg:
                                self.AutoChat(cfg_exitmsg, auto_exit=False)
                            if cfg_exitemo:
                                self.AutoEmo(cfg_exitemo, auto_exit=False)
                            self.AutoExit()
                            return True
                        elif action == "success":
                            if cfg_successmsg:
                                self.AutoChat(cfg_successmsg, auto_exit=False)
                            if cfg_successemo:
                                self.AutoEmo(cfg_successemo, auto_exit=False)
                            self.UploadUID()
                            self.AutoExit()
                            return True
                        self.AutoChat(reply, auto_exit=False)

            y = Py + 119
        return False

    def UploadUID(self):
        console.status("[green]UploadUID")
        self.EnterF2()
        self.Click(279, 179)
        self.WaitColor(421, 166, "DAD5CB")
        self.Click(421, 166)
        self.WaitColor(537, 457, "A7B982")
        (x, y) = self.toScreenPos(518, 164)
        text = OCRNumber((x, y, x + 106 * self.w // 1600, y + 19 * self.h // 900))
        if text:
            console.log(f"[green]UID：[yellow]{text}")
            if re.match(r"^\d{9}$", text):
                for _ in range(3):
                    try:
                        requests.get(f"{cfg_endpoint}add/{text}")
                    except requests.exceptions.RequestException:
                        console.log("[red]上传UID失败")
                        continue
                    break
        self.Click(1, 1)

    def GetUIDList(self):
        try:
            res = requests.get(f"{cfg_endpoint}list")
        except requests.exceptions.RequestException:
            return []
        return res.text.split(",")

    def AutoCook(self):
        console.log("[green]AutoCook")
        if self.EnterMain() and not self.is2p():
            self.AutoF2()
        if self.WaitState("main") and self.is2p():
            if cfg_checkmap and not self.AutoCheckMap():
                self.AutoExit()
                return False
        self.EnterChat()
        time.sleep(2)
        if cfg_entermsg:
            reply_text = re.sub(r"\{TIME\}", getTimeStr(), cfg_entermsg)
            self.AutoChat(reply_text, auto_exit=False)
            time.sleep(3)
        if cfg_enteremo:
            self.AutoEmo(cfg_enteremo, auto_exit=False)
        start_time = time.time()
        wait_time = cfg_timeout
        self.inputSet = set()
        self.replySet = set()
        with console.status("[red]AutoReply"):
            while self.isForeground() and time.time() - start_time < wait_time:
                if self.AutoReply():
                    return True
                time.sleep(1)
        if cfg_timeoutmsg:
            self.AutoChat(cfg_timeoutmsg, auto_exit=False)
        if cfg_timeoutemo:
            self.AutoEmo(cfg_timeoutemo, auto_exit=False)

        self.AutoExit()
        return False


def main_loop():
    hwnd = wg.FindWindow(None, "原神")
    if hwnd == 0:
        console.log("[red]未找到原神窗口 请把游戏窗口分辨率调整到1600X900后运行本程序")
        raise SystemExit()
    wg.SetForegroundWindow(hwnd)
    time.sleep(0.1)
    game = GameControl(hwnd)
    while game.isForeground():
        try:
            if len(game.GetUIDList()) >= 3:
                time.sleep(5)
                continue
            game.AutoCook()
            # game.AutoReply()
        except Exception as e:
            console.log(f"[red]错误：{e}")
        time.sleep(1)
    # console.log(game.AutoCheckMap(teleport=False))
    # game.AutoF2()
    # game.AutoChat("你好！")
    # game.UploadUID()


def main():
    main_loop()


if __name__ == "__main__":
    main()
