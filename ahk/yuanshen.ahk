#Requires AutoHotkey v2.0
;; 自动执行段
;; 脚本设置
#SingleInstance force
SendMode "Input" ; 设置模拟方式
SetKeyDelay 30, 25 ; SendPlay模式延迟
SetWorkingDir A_ScriptDir ; 设置工作目录
SetTitleMatchMode 3
SetCapsLockState 0
SetWinDelay 20

#Include basic.ahk
#Include yuanshen_c.ahk
#Include gui.ahk
#Include yuanshen_h.ahk


; #HotIf WinActive("原神")
; ~F2:: {
;   A_Clipboard := httpRequest("http://47.94.95.163:8887/r/123/poll?user=🦈")
;   _auto_enter_uniq()
; }


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

#HotIf
Launch_Media:: {
  ControlClick "x64 y51", "原神"
}

F12:: ExitApp


; Alt+中键移动窗口
!MButton::
{
  CoordMode "Mouse"
  MouseGetPos &oriX, &oriY, &hwnd
  WinGetPos &winX, &winY, , , hwnd
  Loop
  {
    if !GetKeyState("MButton", "P")
      break
    MouseGetPos &x, &y
    offsetX := x - oriX
    offsetY := y - oriY
    toX := (winX + offsetX)
    toY := (winY + offsetY)
    WinMove toX, toY, , , hwnd
  }
  ToolTip
  CoordMode "Mouse", "Client"
}