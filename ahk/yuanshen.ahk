#Requires AutoHotkey v2.0
;; 自动执行段
;; 脚本设置
#SingleInstance force
SendMode "Input" ; 设置模拟方式
SetKeyDelay 30, 25 ; SendPlay模式延迟
SetWorkingDir A_ScriptDir ; 设置工作目录
SetTitleMatchMode 3
SetCapsLockState 0

#Include basic.ahk
#Include yuanshen_c.ahk
#Include gui.ahk
#Include yuanshen_h.ahk


; #HotIf WinActive("原神")
; ~F2:: _auto_enter_uniq()


OnClipboardChange WatchClipboard
WatchClipboard(data) {
  if data != 1 {
    return
  }
  text := A_Clipboard

  ; if WinActive("QQ频道") or WinActive("自助餐") or WinActive("WeYS") or WinActive("ahk_exe Cursor.exe") or WinActive("ahk_exe Code.exe") {
  ;   _auto_enter_uniq()
  ; }
  if WinActive("WeYS") and RegExMatch(text, "----") {
    _login()
  }
}

F12:: ExitApp