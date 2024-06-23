#Requires AutoHotkey v2.0

#Include counter.ahk

YSMain.Init()
class YSMain {
    static Init() {
        DllCall("shell32\SetCurrentProcessExplicitAppUserModelID", "wstr", "YS AHKv2")
        A_TrayMenu.Insert("E&xit", "计数器", (*) => this.ShowCounter())

        try TraySetIcon("l.ico")
        this.Load()
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
    }
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