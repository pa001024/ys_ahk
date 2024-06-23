#Requires AutoHotkey v2.0

#Include yuanshen_c.ahk
#Include counter.ahk

; 原神
#HotIf WinActive("ahk_exe YuanShen.exe")

CapsLock & F1:: _auto_jinyu() ; 自动刷boss (甘雨竞速版)
CapsLock & `:: _auto_f2() ; 快速F2
; QM
CapsLock & q:: {
    Send "q"
    Sleep 20
    Send "m"
}
global _sw_t := false
; 连跳
CapsLock & t:: {
    SetCapsLockState 0
    global _sw_t
    _sw_t := !_sw_t
    if _sw_t {
        SetTimer(_timer_t, 10)
    } else {
        SetTimer(_timer_t, 0)
    }
    _timer_t() {
        Send "{space}"
    }
}


; 全自动做饭
; CapsLock & F2:: _auto_cook_sevice()


; 进地发
CapsLock & 1:: {
    ; _auto_msg("能让我打个精英怪不 o.0") ; 单刷
    _auto_msg("可以让我的几个朋友进来打下枫丹传奇不 ~~ ") ; 一般
    A_Clipboard := _copy_uid()
    ; _auto_send()
    Sleep 5000
    API.AddUID(A_Clipboard . ".")
    ; _f3()
}
CapsLock & 2:: _auto_msg("你好，我们来打怪了~")
CapsLock & 3:: _auto_msg("你好，还有人没进来，如果显示人数已满麻烦开一下直接加入~")

; 私车正常退出
CapsLock & 4:: {
    _auto_msg("拜拜~祝你游戏愉快")
    _auto_exit()
    t := YSCounter.counter_last_update_time
    ; YSCounter.Add(2)
    YSCounter.Add(10)
    API.AddUID(Format("{1:d} {2}", YSCounter.counter, format_time_diff(getTimeStamp() - t)))
}

; 私车路2
F4:: {
    ; _auto_msg("<散olor=#E99697>拜拜~祝你游戏愉快</散olor>")
    _auto_exit()
    t := YSCounter.counter_last_update_time
    YSCounter.Add(6)
    ; API.AddUID(Format("{1:d} {2}", YSCounter.counter, format_time_diff(getTimeStamp() - t)))
}


F3:: _tp_f1(421, 364, 1218, 364) ; 传送利亚姆
F5:: _tp_f1(718, 500, 995, 358) ; 传送龙溪
; 发地
; F4:: A_Clipboard := _copy_uid()
