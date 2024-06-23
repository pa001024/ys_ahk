#Requires AutoHotkey v2.0
#Include lib.ahk
#Include api.ahk

_auto_exit() {
    Send "{F2}"
    Sleep 600
    ; if GetColor(1305, 845) == "0xECE5D8"
    Click 1305, 845
}
_auto_msg(txt, auto_exit := true) {
    WinGetClientPos(&x, &y, &w, &h)
    loop 5 {
        if CheckColor(854 * w / 1600, 842 * h / 900, "ECE5D8") {
            break
        }
        Send "{Enter}"
        Sleep 200
    }
    if not CheckColor(642 * w / 1600, 842 * h / 900, "FFFFFF") {
        Send "{Enter}"
        Sleep 250
    }
    SendText2(txt)
    Send "{Enter}"
    Sleep 60
    if auto_exit {
        Send "{Escape}"
        Sleep 140
    }
}

_auto_emo(index := 1, auto_exit := false) {
    WinGetClientPos(&x, &y, &w, &h)
    SendAndWaitColor(854 * w / 1600, 842 * h / 900, "ECE5D8", "{Enter}", , 200)
    if CheckColor(770, 838, "ECE5D8") {
        Click 756, 838
        Sleep 400
    }
    if PixelSearch(&Px, &Py, 311, 394, 391, 713, 0x3B4354) {
        rx := Mod(index, 5)
        ry := Floor(index / 5)
        Click Px + 135 * rx, Py + 166 * ry
    }
    if auto_exit {
        Sleep 100
        Send "{Escape}"
        Sleep 150
    }
}

global uid_list := []
_auto_cook_sevice() {
    global uid_list
    uid_list := API.GetUIDList()

    while WinActive("ahk_exe YuanShen.exe") {
        while uid_list.Length < 3 {
            _auto_cook()
        }
        Sleep 3000
        uid_list := API.GetUIDList()
        ; loop 3 {
        ;     if not _auto_check_uid(uid_list[A_Index]) {
        ;         uid_list := API.DelUID(uid_list[A_Index])
        ;     }
        ;     Sleep 1000
        ; }
    }
}

_auto_cook() {
    if not CheckColor(305, 50, "9.D720") {
        _auto_f2()
        Sleep 8000
    }
    if _auto_teleport(1200, true) {
        WaitColor(305, 50, "9.D720")
        Sleep 4000
    } else {
        Sleep 3000
        _auto_exit()
        Sleep 13000
        return
    }
    _auto_msg("你好，可以让我的几个朋友进来打几个怪不~~ ", false)
    Sleep 1000
    _auto_emo(1)
    Sleep 1000
    if _wait_for_res(30)
        return
    ; _auto_emo(9, true)
    _auto_msg("_(:з」∠)_")
    Sleep 3000
    _auto_exit()
    Sleep 13000
}

_wait_for_res(secs) {
    reply := ""
    flag1 := false
    flag2 := false
    flag3 := false
    loop secs {
        ; 复活
        if CheckColor(885, 818, "ECE5D8") {
            Click 885, 818
            Sleep 5000
        }
        startPos := 204
        WinGetClientPos(&x, &y, &w, &h)
        while startPos < 730 {
            ; 查找第一个白色像素点的y坐标
            if not PixelSearch(&x2, &y2, 345, startPos, 351, 759, 0xFFFFFF, 3)
                break
            reply := API.OCRText(x + 357, y + y2 + 42, 158, 32)
            if reply != "" {
                if RegExMatch(reply, "^进|冲冲冲|请便|good|欧克|阔以|^打呗?吧?$|^来|可以|^可|^行|彳亍|[Oo][Kk]|^好|^哦|^嗯|^1|^hao|一起|随便|随意|^去|自便|自取|没问题|当然|欢迎") {
                    _auto_msg("好的，我先走啦，一会就来~~ 谢谢~~")
                    Sleep 1000
                    global uid_list
                    uid := _copy_uid(true)
                    uid_list := API.AddUID(uid)
                    _auto_exit()
                    Sleep 15000
                    return true
                } else if RegExMatch(reply, "^不|shg|珊瑚宫|锄地|留着") {
                    _auto_msg("打扰了！")
                    _auto_exit()
                    Sleep 15000
                    return true
                }
                ; 自动回复
                if RegExMatch(reply, "干什么|为什么|干嘛|干吗") {
                    if not flag1 {
                        _auto_msg("这怪有几百万血，不过掉的摩拉也多3000摩拉一只，每天最多120W摩拉~", false)
                        flag1 := true
                        Sleep 1000
                    }
                } else if RegExMatch(reply, "什么|啥|\\?|哪个|那个") {
                    if not flag2 {
                        Sleep 2000
                        _auto_msg("就是枫丹湖中垂柳右边的地方传奇，每天刷新的~~ 2分钟差不多打完了~", false)
                        flag2 := true
                        Sleep 1000
                        secs := 45
                    }
                } else if RegExMatch(reply, "帮我|帮忙|^帮") {
                    if not flag3 {
                        Sleep 2000
                        _auto_msg("要帮忙的话可以让他们帮哦，我只是来问一下一会就走了~~", false)
                        flag3 := true
                        Sleep 1000
                    }
                }
            }
            startPos := y2 + 119
        }
        if CheckColor(30, 46, "ECE5D8") {
            ; Send "{Escape}"
            ; Sleep 500
        } else if not CheckColor(303, 50, "96D720") {
            while CheckColor(300, 300, "1C1C22") or CheckColor(300, 300, "FFFFFF") {
                Sleep 1000
                if A_Index > 30 {
                    break
                }
            }
            Sleep 12000
            return true
        }
        Sleep 1000
    }
    return false
}

_auto_check_uid(uid := A_Clipboard) {
    A_Clipboard := uid
    WinGetClientPos(&x, &y, &w, &h)
    if not CheckColor(380 * w / 1600, 844 * h / 900, "ECE5D8") {
        Send "{F2}"
        Sleep 800
    }
    if not CheckColor(1218 * w / 1600, 90 * h / 900, "FFFFFF") {
        Click 1242 * w / 1600, 103 * h / 900
        Sleep 200
    }
    Click 1242 * w / 1600, 103 * h / 900
    Sleep 60
    Click 1403 * w / 1600, 101 * h / 900
    Sleep 100

    return not CheckColor(257 * w / 1600, 295 * h / 900, "D.D.C.")
}

_auto_teleport(delay := 800, checkonly := false) {
    WinGetClientPos(&x, &y, &w, &h)
    ; 切区域
    _reset_map(delay)

    if not WaitColor(1535, 25, "ECE5D8") {
        return false
    }
    ; 调缩放
    if PixelSearch(&Px, &Py, 37, 365, 36, 534, 0xEDE5DA, 0) && Py >= 440 {
        while not CheckColor(39, 440, "EDE5DA") {
            Send "{WheelUp}"
            Sleep 40
            if A_Index > 20
                break
        }
    } else {
        while not CheckColor(39, 457, "EDE5DA") {
            Send "{WheelDown}"
            Sleep 40
            if A_Index > 20
                break
        }
    }
    ; 拖地图
    Sleep 200
    while not _drag_map() {
        Click "Up"
        _reset_map(delay)
        if delay == 800 or A_Index > 2 {
            break
        }
        Sleep 1000
    }
    Sleep 50
    if checkonly {
        ret := PixelSearch(&Px, &Py, 520, 392, 970, 394, 0xFEFEFE, 4)
        send "m"
        return ret
    }
    if PixelSearch(&Px, &Py, 520, 392, 970, 394, 0xFEFEFE, 4) {
        Click "Up"
        Sleep 100
        Click Px, Py ; 水泽
        Sleep 50
        Click 1310, 839
        return true
    } else {
        if delay > 800 {
            send "m"
        } else {
            Click 788, 395, 0 ; 水泽
        }
        return false
    }
}

_reset_map(delay) {
    WinGetClientPos(&x, &y, &w, &h)
    Click "Up"
    while not CheckColor(1535, 25, "ECE5D8") {
        Send "m"
        Sleep delay
        if A_Index > 2 {
            break
        }
    }
    Click 1532 * w / 1600, 846 * h / 900 ; 地图
    Sleep 200
    Click 1272 * w / 1600, 327 * h / 900 ; 枫丹
    Sleep delay
}

_drag_map() {
    Click "Up"
    Click 1450, 373, "Down"
    loop {
        mouseXY(-40, 0)
        Sleep 11
        if A_Index > 10 {
            ; 找锚点
            if PixelSearch(&Px, &Py, 540, 392, 950, 394, 0xFEFEFE, 4) {
                return true
            }
            if A_Index > 15
                return false
        }
    }
    Click "Up"
}

_copy_uid(flag := false) {
    Send "{F2}"
    Sleep 800
    WinGetClientPos(&x, &y, &w, &h)
    Click 279 * w / 1600, 179 * h / 900
    ; Click 206 * w / 1600, 194 * h / 900 ;测试
    Sleep 400
    Click 488 * w / 1600, 172 * h / 900
    Sleep 400

    uid := API.OCRUID(x + 516, y + 161, 110 * w / 1600, 23 * w / 1600)
    Send "{Escape}"
    Sleep 80
    if not flag {
        Send "{Escape}"
        Sleep 50
    }
    return uid
}
_login() {
    now := A_TickCount
    while not WinActive("原神") {
        WinActivate "原神"
        Sleep 100
        if A_TickCount - now > 30e3
            return false
    }
    WaitColor(637, 213, "FFFFFF", 20e3)
    array := StrSplit(A_Clipboard, "----")
    has_uid := RegExMatch(array[1], "^\d{9}$")
    index := 1 + (has_uid ? 1 : 0)
    Click 977, 348
    Sleep 20
    A_Clipboard := array[index]
    SendEvent "^v"
    Sleep 20
    Click 991, 420
    A_Clipboard := array[index + 1]
    SendEvent "^v"
    now := A_TickCount
    while not CheckColor(582, 512, "DEBC60") {
        Sleep 20
        Click 582, 512
        if A_TickCount - now > 1e3
            return false
        else
            Sleep 500
    }
    Sleep 40
    Click 797, 578 ; 登录
}

last_uid := ""
_auto_enter_uniq() {
    global last_uid
    if A_Clipboard == last_uid {
        return true
    }
    last_uid := A_Clipboard
    if RegExMatch(A_Clipboard, "^\d{9}$") {
        _auto_enter()
    }
}

_auto_enter() {
    WinActivate "原神"
    WinGetClientPos(&x, &y, &w, &h, "原神")
    if not CheckColor(380 * w / 1600, 844 * h / 900, "ECE5D8") {
        Send "{F2}"
        Sleep 800
    }
    if not CheckColor(1218 * w / 1600, 90 * h / 900, "FFFFFF") {
        Click 1242 * w / 1600, 103 * h / 900 ; 清空
        Sleep 200
    }
    Click 1242 * w / 1600, 103 * h / 900 ; 粘贴
    Sleep 60
    Click 1403 * w / 1600, 101 * h / 900 ; 搜索
    Sleep 200

    if not CheckColor(257 * w / 1600, 295 * h / 900, "D.D.C.") {
        Click 1355 * w / 1600, 199 * h / 900
    }
}

_LineSep := Chr(13) . Chr(10)
_auto_send(reply := "") {
    WinGetClientPos(&x, &y, &w, &h, "QQ频道")
    CoordMode "Pixel", "Screen"
    isSub := CheckColor(x + w - 115, y + h - 36, "1B1B1B")
    CoordMode "Pixel", "Client"
    if isSub {
        ControlClick "x" . (w - 120) . " y" . (h - 36), "QQ频道", , "RIGHT" ; 右键
        ControlClick "x" . (w - 84) . " y" . (h - 60), "QQ频道" ; 粘贴
        Sleep 450
        ControlClick "x" . (w - 54) . " y" . (h - 40), "QQ频道"
    } else {
        ControlClick "x" . (w - 539) . " y" . (h - 145), "QQ频道", , "RIGHT" ; 右键
        ControlClick "x" . (w - 496) . " y" . (h - 60), "QQ频道" ; 粘贴
        Sleep 450
        ControlClick "x" . (w - 74) . " y" . (h - 36), "QQ频道"
    }
    return true
}
_auto_jinyu() {
    Sleep 333
    SetCapsLockState 1
    BlockInput "On"

    while GetKeyState("CapsLock", "T") {
        ; 进本
        Send "f"
        Sleep 1500
        Click 1426, 846 ; 单人挑战
        Sleep 300
        Click 986, 629 ; 确认
        Sleep 1400
        Click 1426, 846 ; 开始挑战
        ; 检测白屏
        Sleep 2000
        while not CheckColor(837, 536, "3B4255") {
            Sleep 1000
            if A_Index > 100
                break
        }
        Sleep 800
        Click ; 开始
        Sleep 3000
        ysAction("4", true, 500)
        ysAction("2", true, 500)
        ysAction("3", false, 900)
        Send "1"
        Sleep 500
        HoldLeft(1800)
        Sleep 800
        mouseXY(120, -400)
        HoldLeft(2000)
        Sleep 400
        Send "e" ; 6命
        Sleep 500
        mouseXY(0, -500)
        HoldLeft(400)
        Sleep 400
        Send "e" ; 6命
        Sleep 500
        mouseXY(0, -450)
        HoldLeft(400)
        Sleep 1000

        ; 离场
        Send "{Escape}"
        Sleep 450
        Click 1057, 655
        Sleep 2800
        Click 852, 815 ; 点退出
        Sleep 2000
        while CheckColor(477, 266, "FFFFFF") {
            Sleep 1000
            if A_Index > 100
                break
        }
        Sleep 1200
    }
    BlockInput "Off"
    HoldLeft(t) {
        Click "Down"
        Sleep t
        Click "Up"
    }

    ysAction(chr, hold := false, slp := 0) {
        Send chr
        Sleep 300
        if hold {
            Send "{e Down}"
            Sleep 1000
            Send "{e Up}"
        } else {
            Send "e"
        }
        Sleep slp
    }
}
_auto_f2() {
    WinGetClientPos(&x, &y, &w, &h)
    while not (CheckColor(300, 300, "1C1C22") or CheckColor(300, 300, "FFFFFF")) {
        Send "{F2}"
        Sleep 480
        MouseMove 55, 10
        loop 10 {
            if CheckColor(61, 38, "D3BC8E") {
                Click 1349, 197 + 104 * (A_Index - 1)
                break
            }
            Sleep 200
        }
        loop 6 {
            ; ToolTip(CheckColor(1352, 182 + 104 * (A_Index - 1), "323232"))
            if CheckColor(1352, 158 + 104 * (A_Index - 1), "3.3.3.")
                Click 1349, 197 + 104 * (A_Index - 1)
        }
        Sleep 33
        Send "{Escape}"
        Sleep 450
        if A_Index > 30
            break
    }
}

_tp_boss_bottom() {
    while not CheckColor(1391, 195, "D0B8AC") {
        Send "{F1}"
        Sleep 20
        if A_Index > 100 {
            return
        }
    }
    Click 247, 455 ; 讨伐
    Sleep 1
    loop 2 {
        Click 474, 171 ; 全部
        Sleep 1
        Click 466, 357 ; 首领
        Sleep 1
    }
    while not CheckColor(798, 687, "FFFFFF") {
        Click 797, 701 ; 滚动条
        Sleep 16
        if A_Index > 9 {
            return
        }
    }
    Sleep 100
}

_tp_trace() {
    loop 2 {
        Sleep 1
        Click 1212, 700 ; 追踪
    }
    Sleep 220
}

_tp_f1(x1, y1, x2, y2) {
    _tp_boss_bottom()
    loop 3 {
        Click x1, y1 ; 冰风
        Sleep 10
    }
    _tp_trace()
    loop 5 {
        Click x2, y2 ; 锚点
        Sleep 1
        Click 1299, 817 ; 传送
        Sleep 99
    }
}