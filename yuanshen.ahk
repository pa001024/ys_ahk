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

global _local_counter := 0
if FileExist("counter.txt")
  _local_counter := Number(FileRead("counter.txt"))

add_counter_local() {
  global _local_counter := _local_counter + 1
  try FileDelete("counter.txt")
  FileAppend(String(_local_counter), "counter.txt")
  return _local_counter
}
reset_counter_local() {
  global _local_counter := 0
  try FileDelete("counter.txt")
  return _local_counter
}

; 全自动做饭
CapsLock & F2:: _auto_cook_sevice()

; 进地发
CapsLock & 1:: {
  ; _auto_msg("能让我打个精英怪不 o.0") ; 单刷
  _auto_msg("可以让我的几个朋友进来打下枫丹传奇不 ~~ ") ; 一般
  A_Clipboard := _copy_uid()
  _auto_send()
  ; _f3()
}
CapsLock & 2:: _auto_msg("我们刷的怪有几百万血，不过掉的摩拉也多3000摩拉一只，每天最多120W摩拉~")
CapsLock & 3:: _auto_msg("我们三个是一起的，如果显示人数已满麻烦开一下直接加入~")

; 私车正常退出
CapsLock & 4:: {
  _auto_msg("<散olor=#E99697>拜拜~祝你游戏愉快</散olor>")
  _auto_exit()
  YSCounter.Add(4)
}
; 传送利亚姆
F3:: {
  Send "{F1}"
  Sleep 800
  Click 247, 455 ; 讨伐
  Sleep 50
  Click 474, 171 ; 全部
  Sleep 50
  Click 466, 357 ; 首领
  Sleep 50
  Click 797, 701 ; 滚动条
  Sleep 50
  Click 797, 701 ; 滚动条
  Sleep 300
  Click 421, 364 ; 冰风
  Sleep 1
  Click 1212, 700 ; 取消追踪
  Sleep 1
  Click 1212, 700 ; 追踪
  Sleep 600
  Click 1218, 364 ; 锚点
  Sleep 50
  Click 1233, 839 ; 传送
}
; 打完拳皇传送2
F5:: {
  ; 全自动1
  Send "{F1}"
  Sleep 800
  Click 247, 455 ; 讨伐
  Sleep 50
  Click 717, 592 ; 猊兽
  Sleep 1
  Click 1212, 700 ; 取消追踪
  Sleep 1
  Click 1212, 700 ; 追踪
  Sleep 300
  Click 995, 358 ; 锚点
  Sleep 50
  Click 1233, 839 ; 传送
  ; 全自动2
  ; Send "{F1}"
  ; Sleep 400
  ; Click 247, 455 ; 讨伐
  ; Sleep 50
  ; Click 474, 171 ; 全部
  ; Sleep 1
  ; Click 466, 357 ; 首领
  ; Sleep 1
  ; Click 725, 429 ; 纯水
  ; Sleep 1
  ; Click 1212, 700 ; 取消追踪
  ; Sleep 1
  ; Click 1212, 700 ; 追踪
  ; Sleep 100
  ; Click 38, 542 ; -
  ; Sleep 100
  ; Click 108, 535 ; 锚点
  ; Sleep 80
  ; Click 1233, 839 ; 传送
  ; 半自动
  ; Send "m"
  ; Sleep 750
  ; Click 1029, 893, "Down"
  ; loop {
  ;   mouseXY(-16, -22)
  ;   Sleep 2
  ;   if A_Index > 22
  ;     break
  ; }
  ; Click "Up"
  ; Click 580, 544, 0
}
; 发地
F4:: A_Clipboard := _copy_uid()


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
#HotIf