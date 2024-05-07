#Requires AutoHotkey v2.0
#Include lib.ahk


class API {
    static OCRUID(x, y, w, h) {
        url := Format('http://localhost:8888/uid?x={1:d}&y={2:d}&w={3:d}&h={4:d}', x, y, w, h)
        return httpRequest(url)
    }
    static OCRText(x, y, w, h) {
        url := Format('http://localhost:8888/text?x={1:d}&y={2:d}&w={3:d}&h={4:d}', x, y, w, h)
        return httpRequest(url)
    }
    static baseUrl := 'https://pa001024.pythonanywhere.com/'
    static GetUIDList() {
        url := this.baseUrl . 'list'
        return StrSplit(httpRequest(url), ",")
    }
    static AddUID(uid) {
        url := Format(this.baseUrl . 'add/{1:s}', uid)
        return StrSplit(httpRequest(url), ",")
    }
    static DelUID(uid) {
        url := Format(this.baseUrl . 'del/{1:s}', uid)
        return StrSplit(httpRequest(url), ",")
    }
}