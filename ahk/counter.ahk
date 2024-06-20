#Requires AutoHotkey v2.0

; 计数器类
class YSCounter {
    static oGui := this.InitGui()
    static visible := false
    static counter := 0
    static counter_last_update_time := getTimeStamp()

    ; 加载计数器的初始状态
    static Load() {
        ; 从配置文件ys-ahk.ini中读取计数器的值
        this.counter := IniRead("ys-ahk.ini", "counter", "value", 0)
        this.oGui["Val"].value := String(this.counter)
        this.oGui["Time"].value := IniRead("ys-ahk.ini", "counter", "time1", "+0:00:00.000") . Chr(10) . IniRead("ys-ahk.ini", "counter", "time2", "+0:00:00.000")
        this.counter_last_update_time := IniRead("ys-ahk.ini", "counter", "counter_last_update_time", getTimeStamp())
    }

    ; 初始化GUI窗口
    static InitGui() {
        oGui := Gui("AlwaysOnTop +DPIScale", "计数器")  ; 创建具有指定选项的 GUI
        oGui.AddText("x16 y16 w80 h45 vVal Center", "0").SetFont("s26", "Arial")  ; 添加文本控件用于显示计数器数值
        oGui.AddText("x+10 yp w160 hp vTime Center", "+0:00:00.000" . Chr(10) . "+0:00:00.000").SetFont("s14")  ; 添加文本控件用于显示时间
        oGui.AddButton("x20 y+12 w50 h22 Section", "=0").OnEvent("Click", (*) => this.Add(0))
        oGui.AddButton("x+8 ys wp hp", "-1").OnEvent("Click", (*) => this.Add(-1))
        oGui.AddButton("x+8 ys wp hp", "+1").OnEvent("Click", (*) => this.Add(+1))
        oGui.AddButton("x+8 ys wp hp", "+2").OnEvent("Click", (*) => this.Add(+2))
        oGui.AddButton("x20 y+4 wp hp Section", "+3").OnEvent("Click", (*) => this.Add(+3))
        oGui.AddButton("x+8 ys wp hp", "+4").OnEvent("Click", (*) => this.Add(+4))
        oGui.AddButton("x+8 ys wp hp", "+5").OnEvent("Click", (*) => this.Add(+5))
        oGui.AddButton("x+8 ys wp hp", "+10").OnEvent("Click", (*) => this.Add(+10))
        oGui.OnEvent("Close", (*) => this.Close())
        return oGui
    }

    static Show() {
        this.Load()
        this.oGui.Show("w264 h140 x16 y" . (A_ScreenHeight - 120 - 140) . "NoActivate")
        A_TrayMenu.Check("计数器")
        this.visible := true
    }
    static Close() {
        this.oGui.Hide()
        A_TrayMenu.Uncheck("计数器")
        this.visible := false
        IniWrite(0, "ys-ahk.ini", "counter", "show")
    }

    static Save() {
        IniWrite(this.counter, "ys-ahk.ini", "counter", "value")
        IniWrite(this.counter_last_update_time, "ys-ahk.ini", "counter", "counter_last_update_time")
        old := StrSplit(this.oGui["Time"].value, Chr(10))
        IniWrite(old[1], "ys-ahk.ini", "counter", "time1")
        IniWrite(old[2], "ys-ahk.ini", "counter", "time2")
    }

    ; 定义一个静态方法Add，用于向计数器添加指定值
    static Add(r) {
        ; 如果指定的值为0，则将计数器清零并保存
        if r == 0 {
            this.counter := 0
            this.oGui["Val"].value := String(this.counter)
            this.counter_last_update_time := getTimeStamp()
            this.Save()
            return
        }
        this.counter := this.counter + r
        this.oGui["Val"].value := String(this.counter)
        if r > 0 and getTimeStamp() - this.counter_last_update_time > 5000 {
            old := StrSplit(this.oGui["Time"].value, Chr(10))
            this.oGui["Time"].value := old[2] . Chr(10) . format_time_diff(getTimeStamp() - this.counter_last_update_time)
            this.counter_last_update_time := getTimeStamp()
        }
        this.Save()
    }
}

YSCounter.Load()

format_time_diff(t) {
    milliseconds := mod(t, 1000)
    seconds := mod(t / 1000, 60)
    minutes := mod(t / (1000 * 60), 60)
    hours := t / (1000 * 60 * 60)
    if hours >= 1 {
        return Format("+{:d}:{:02d}:{:02d}.{:03d}", hours, minutes, seconds, milliseconds)
    }
    else {
        return Format("+{:02d}:{:02d}.{:03d}", minutes, seconds, milliseconds)
    }
}