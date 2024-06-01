#Requires AutoHotkey v2.0
;; 自动执行段
;; 脚本设置
#SingleInstance force
SendMode "Input" ; 设置模拟方式
SetKeyDelay 30, 25 ; SendPlay模式延迟
SetWorkingDir A_ScriptDir ; 设置工作目录
SetTitleMatchMode 3
SetCapsLockState 0

#Include ahk/basic.ahk
#Include ahk/yuanshen_c.ahk
#Include ahk/counter.ahk
#Include ahk/uid.ahk

YSMain.Init()
class YSMain {
  static Init() {
    DllCall("shell32\SetCurrentProcessExplicitAppUserModelID", "wstr", "YS AHKv2")
    A_TrayMenu.Insert("E&xit", "UID", (*) => this.ShowUID())
    A_TrayMenu.Insert("E&xit", "计数器", (*) => this.ShowCounter())

    try TraySetIcon("l.ico")
    this.Load()
    
    API.GetUIDList()
  }

  static ShowUID() {
    if YSUID.visible {
      YSUID.Close()
      IniWrite(0, "ys-ahk.ini", "uid", "show")
    } else {
      YSUID.Show()
      IniWrite(1, "ys-ahk.ini", "uid", "show")
    }
  }

  static ShowCounter() {
    if YSCounter.visible {
      YSCounter.Close()
      IniWrite(0, "ys-ahk.ini", "counter", "show")
    } else {
      YSCounter.Show()
      IniWrite(1, "ys-ahk.ini", "counter", "show")
    }
  }

  static Load() {
    if showCounter := IniRead("ys-ahk.ini", "counter", "show", 0)
      this.ShowCounter()
    if showUID := IniRead("ys-ahk.ini", "uid", "show", 0)
      this.ShowUID()
  }
}


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
  _auto_msg("<散olor=#E99697>拜拜~祝你游戏愉快</散olor>")
  _auto_exit()
  t := YSCounter.counter_last_update_time
  ; YSCounter.Add(2)
  YSCounter.Add(4)
  API.AddUID(Format("{1:d} {2}", YSCounter.counter, format_time_diff(getTimeStamp() - t)))
}

; 私车路2
F4:: {
  ; _auto_msg("<散olor=#E99697>拜拜~祝你游戏愉快</散olor>")
  _auto_exit()
  t := YSCounter.counter_last_update_time
  YSCounter.Add(2)
  API.AddUID(Format("{1:d} {2}", YSCounter.counter, format_time_diff(getTimeStamp() - t)))
}

; 计数器
CapsLock & Numpad1:: YSCounter.Add(1)
CapsLock & Numpad2:: YSCounter.Add(2)
CapsLock & Numpad3:: YSCounter.Add(3)
CapsLock & Numpad4:: YSCounter.Add(4)
CapsLock & Numpad5:: YSCounter.Add(5)
CapsLock & Numpad6:: YSCounter.Add(6)
CapsLock & Numpad7:: YSCounter.Add(7)
CapsLock & Numpad8:: YSCounter.Add(8)
CapsLock & Numpad9:: YSCounter.Add(9)
CapsLock & Numpad0:: YSCounter.Add(-1)

F3:: _tp_f1(421, 364, 1218, 364) ; 传送利亚姆
F5:: _tp_f1(718, 500, 995, 358) ; 传送龙溪
; 发地
; F4:: A_Clipboard := _copy_uid()


; 一键登录
#HotIf WinActive("ahk_exe Cursor.exe") or WinActive("ahk_exe Code.exe")

XButton2:: _login()
; 一键抢地
#HotIf WinActive("QQ")
XButton2:: {
  Click 2
  SendEvent "^c"
  _auto_enter()
}
#HotIf WinActive("QQ频道")
XButton2:: {
  Click 2
  SendEvent "^c"
  _auto_enter()
}
F2:: {
  SendEvent "^c"
  _auto_enter()
}
#HotIf WinActive("自助餐")
MButton:: {
  global last_uid
  Click
  Sleep 50
  if WinActive("自助餐") and RegExMatch(A_Clipboard, "^\d{9}$") {
    last_uid := A_Clipboard
    _auto_enter()
  }
}

last_uid := ""
#HotIf WinActive("原神")
~F2:: {
  global last_uid
  if A_Clipboard == last_uid {
    return true
  }
  last_uid := A_Clipboard
  if RegExMatch(A_Clipboard, "^\d{9}$") {
    _auto_enter()
  }
}