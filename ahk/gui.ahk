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