#Requires AutoHotkey v2.0
#Include lib.ahk

; 按键映射
Insert::=

CapsLock & r:: Reload()
; 鼠标连点
CapsLock & x:: {
    ; BlockInput On
    while GetKeyState("x", "P") {
        Click "Down"
        Sleep 22
        Click "Up"
        Sleep 22
    }
    return
}

; 精确移动鼠标
CapsLock & Left:: mouseXY(-1, 0)
CapsLock & Up:: mouseXY(0, -1)
CapsLock & Right:: mouseXY(1, 0)
CapsLock & Down:: mouseXY(0, 1)


; 锁定键盘鼠标
CapsLock & l:: toggleKeyb()
toggleKeyb() {
    static trigger := 0
    if (trigger = 0) {
        BlockInput 1
        trigger := 1
        msg("BlockInput On")
    }
    else {
        BlockInput 0
        trigger := 0
        msg("BlockInput Off")
    }
}