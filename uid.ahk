#Requires AutoHotkey v2.0
#Include api.ahk

; UID GUI
class YSUID {
    static oGui := this.InitGui()
    static visible := false
    static InitGui() {
        oGui := Gui("MinSize +DPIScale AlwaysOnTop", "UID")
        oGui.AddButton("w240 r1 x12 vEdit_UID1").OnEvent("Click", (*) => this.ComboUID(oGui["Edit_UID1"].Text))
        oGui.AddButton("w75", "Enter").OnEvent("Click", (*) => this.EnterUID(oGui["Edit_UID1"].Text))
        oGui.AddButton("wp x+8 yp", "Send").OnEvent("Click", (*) => this.SendUID(oGui["Edit_UID1"].Text))
        oGui.AddButton("wp x+8 yp", "Delete").OnEvent("Click", (*) => this.DeleteUID(oGui["Edit_UID1"].Text))
        oGui.AddButton("w240 r1 x12 vEdit_UID2").OnEvent("Click", (*) => this.ComboUID(oGui["Edit_UID2"].Text))
        oGui.AddButton("w75", "Enter").OnEvent("Click", (*) => this.EnterUID(oGui["Edit_UID2"].Text))
        oGui.AddButton("wp x+8 yp", "Send").OnEvent("Click", (*) => this.SendUID(oGui["Edit_UID2"].Text))
        oGui.AddButton("wp x+8 yp", "Delete").OnEvent("Click", (*) => this.DeleteUID(oGui["Edit_UID2"].Text))
        oGui.AddButton("w240 r1 x12 vEdit_UID3").OnEvent("Click", (*) => this.ComboUID(oGui["Edit_UID3"].Text))
        oGui.AddButton("w75", "Enter").OnEvent("Click", (*) => this.EnterUID(oGui["Edit_UID3"].Text))
        oGui.AddButton("wp x+8 yp", "Send").OnEvent("Click", (*) => this.SendUID(oGui["Edit_UID3"].Text))
        oGui.AddButton("wp x+8 yp", "Delete").OnEvent("Click", (*) => this.DeleteUID(oGui["Edit_UID3"].Text))
        oGui.OnEvent("Close", (*) => this.Close())
        return oGui
    }
    static timer_cb := () => this.Refresh()
    static Show() {
        this.oGui.Show("NoActivate " . Format("x{:d} y{:d}", A_ScreenWidth - 345, A_ScreenHeight - 452))
        A_TrayMenu.Check("UID")
        this.visible := true
        this.Refresh()
        SetTimer(this.timer_cb, 2000)
    }
    static Close() {
        this.oGui.Hide()
        A_TrayMenu.Uncheck("UID")
        this.visible := false
        IniWrite(0, "ys-ahk.ini", "uid", "show")
        SetTimer(this.timer_cb, 0)
    }
    static Refresh() {
        list := API.GetUIDList()
        this.Set(list)
    }
    static Set(list) {
        loop 3 {
            _i := String(A_Index)
            if A_Index <= list.Length {
                this.oGui["Edit_UID" . _i].Text := list[_i]
            } else {
                this.oGui["Edit_UID" . _i].Text := ""
            }
        }
    }
    static ComboUID(uid) {
        A_Clipboard := uid
        _auto_enter()
        _auto_send()
        list := API.DelUID(uid)
        this.Set(list)
    }
    static EnterUID(uid) {
        A_Clipboard := uid
        _auto_enter()
    }
    static SendUID(uid) {
        A_Clipboard := uid
        _auto_send()
    }
    static DeleteUID(uid) {
        list := API.DelUID(uid)
        this.Set(list)
    }
}