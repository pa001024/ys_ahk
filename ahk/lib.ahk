; 函数

mouseXY(x, y) {
  DllCall("mouse_event", "int", 1, "int", x, "int", y, "uint", 0, "uint", 0)
}

msg(text, dur := 1000) {
  ToolTip text
  SetTimer endmsg, dur
}
msgl(text, dur := 1000) {
  ToolTip text, 0, 0
  SetTimer endmsg, dur
}

GetColor(x, y) {
  color := PixelGetColor(x, y)
  return SubStr(color, -10)
}

CheckColor(x, y, v) {
  color := PixelGetColor(x, y)
  return RegExMatch(SubStr(color, 3, 6), v) == 1
}

WaitColor(x, y, v, timeout := 1000, interval := 100) {
  s := A_TickCount
  Loop {
    if CheckColor(x, y, v)
      return true
    else
      Sleep interval
    if timeout > 0 and A_TickCount - s > timeout
      return false
  }
}

SendAndWaitColor(x, y, v, key, timeout := 1000, interval := 100) {
  s := A_TickCount
  Loop {
    if CheckColor(x, y, v)
      return true
    else {
      Send key
      Sleep interval
    }
    if timeout > 0 and A_TickCount - s > timeout
      return false
  }
}

endmsg() {
  ToolTip
  SetTimer , 0
}

SendText2(text) {
  bak := ClipboardAll()
  A_Clipboard := text
  SendEvent "^v"
  Sleep 100
  A_Clipboard := bak
}

req := comObject("WinHttp.WinHttpRequest.5.1")
httpRequest(url, method := "GET", headers := "", data := "", userAgent := "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36") {
  req.Open(method, url, true) ;true 表示异步
  req.SetRequestHeader("User-Agent", userAgent)
  req.Send()
  req.WaitForResponse()
  return req.ResponseText
}

;----------------------------------------------------------------------------------------------------------等待动画类 class
;----------------------------------------------------------------------------------------------------------image GDI+
class imageutil
{
  ; GDI句柄
  static GdipToken := 0

  ; 当前托盘图标,防止重复创建同一图标
  static trayiconFlag := 0

  ; 初始化GDI+模块
  static init()
  {
    DllCall("LoadLibrary", "str", "gdiplus")
    si := Buffer(A_PtrSize = 4 ? 16 : 24, 0) ; sizeof(GdiplusStartupInput) = 16, 24
    NumPut("uint", 0x1, si)
    DllCall("gdiplus\GdiplusStartup", "ptr*", &GdipToken := 0, "ptr", si, "ptr", 0)
    this.GdipToken := GdipToken
  }
  ; 保存图片,默认png格式 ,filepath:路径,minW/minH:缩放的最小宽度/高度小于就缩放scale倍数,sextension文件类型png
  static saveclip(filepath, minW := 0, minH := 0, scale := 1, extension := "png")
  {
    if not (pBitmap := this.getBitFromClip())
      throw Error("获取pBitmap异常")
    this.saveBitmap(pBitmap, filepath, minW, minH, scale, extension)
  }
  ; 保存bitmap图片
  static saveBitmap(pBitmap, filepath, minW := 0, minH := 0, scale := 1, extension := "png")
  {
    if not pBitmap
      throw Error("传入pBitmap异常")
    this.select_codec(pBitmap, &pCodec, &ep, &ci, &v, extension)
    DllCall("gdiplus\GdipGetImageWidth", "ptr", pBitmap, "uint*", &width := 0)  ;获取图片宽度
    DllCall("gdiplus\GdipGetImageHeight", "ptr", pBitmap, "uint*", &height := 0) ;获取图片高度
    scale := (width < minW or height < minH) ? scale : 1
    this.BitmapScale(&pBitmap, scale)  ;缩放
    Loop {
      if !DllCall("gdiplus\GdipSaveImageToFile", "ptr", pBitmap, "wstr", filepath, "ptr", pCodec, "ptr", IsSet(ep) ? ep : 0)
        break
      else
        if A_Index < 6
          Sleep (2 ** (A_Index - 1) * 30)
        else
          throw Error("保存图片异常")
    }
  }
  ; 获取粘贴板数据返回bitmap的指针 pBitmap ，非图片时报错
  static getBitFromClip() {
    Loop {
      if DllCall("OpenClipboard", "ptr", A_ScriptHwnd)
        break
      else
        if A_Index < 6
          Sleep (2 ** (A_Index - 1) * 30)
        else
          throw Error("打开剪切板失败")
    }
    if !DllCall("IsClipboardFormatAvailable", "uint", 2) { ;CF_BITMAP
      DllCall("CloseClipboard")
      throw Error("获取CF_BIUTMAP失败")
    }
    if !(hbm := DllCall("GetClipboardData", "uint", 2, "ptr")) {
      DllCall("CloseClipboard")
      throw Error("获取剪切板数据失败")
    }
    DllCall("gdiplus\GdipCreateBitmapFromHBITMAP", "ptr", hbm, "ptr", 0, "ptr*", &pBitmap := 0)
    DllCall("DeleteObject", "ptr", hbm)
    DllCall("CloseClipboard")
    return pBitmap
  }
  ; 获取图片的编码信息
  static select_codec(pBitmap, &pCodec, &ep, &ci, &v, extension := "png", quality := 100) {
    ; Fill a buffer with the available image codec info.
    DllCall("gdiplus\GdipGetImageEncodersSize", "uint*", &count := 0, "uint*", &size := 0)
    DllCall("gdiplus\GdipGetImageEncoders", "uint", count, "uint", size, "ptr", ci := Buffer(size))
    loop {
      if (A_Index > count) ;Could not find a matching encoder for the specified file format.
        throw Error("找不到匹配的图片编码")
      idx := (48 + 7 * A_PtrSize) * (A_Index - 1)
    } until InStr(StrGet(NumGet(ci, idx + 32 + 3 * A_PtrSize, "ptr"), "UTF-16"), extension) ; FilenameExtension
    pCodec := ci.ptr + idx ; ClassID
    return 1
  }
  ; 缩放图片,scale 缩放倍数，可以是数组[m,n] 表示长度缩放m倍数，宽度缩放n倍数
  static BitmapScale(&pBitmap, scale) {
    if not (IsObject(scale) && ((scale[1] ~= "^\d+$") || (scale[2] ~= "^\d+$")) || (scale ~= "^\d+(\.\d+)?$"))
      throw Error("缩放倍数异常scale：" . scale)

    ; Get Bitmap width, height, and format.
    DllCall("gdiplus\GdipGetImageWidth", "ptr", pBitmap, "uint*", &width := 0)
    DllCall("gdiplus\GdipGetImageHeight", "ptr", pBitmap, "uint*", &height := 0)
    DllCall("gdiplus\GdipGetImagePixelFormat", "ptr", pBitmap, "int*", &format := 0)

    if IsObject(scale) {
      safe_w := (scale[1] ~= "^\d+$") ? scale[1] : Round(width / height * scale[2])
      safe_h := (scale[2] ~= "^\d+$") ? scale[2] : Round(height / width * scale[1])
    } else {
      safe_w := Ceil(width * scale)
      safe_h := Ceil(height * scale)
    }

    ; Avoid drawing if no changes detected.
    if (safe_w = width && safe_h = height)
      return pBitmap

    ; Create a new bitmap and get the graphics context.
    DllCall("gdiplus\GdipCreateBitmapFromScan0"
      , "int", safe_w, "int", safe_h, "int", 0, "int", format, "ptr", 0, "ptr*", &pBitmapScale := 0)
    DllCall("gdiplus\GdipGetImageGraphicsContext", "ptr", pBitmapScale, "ptr*", &pGraphics := 0)

    ; Set settings in graphics context.
    DllCall("gdiplus\GdipSetPixelOffsetMode", "ptr", pGraphics, "int", 2) ; Half pixel offset.
    DllCall("gdiplus\GdipSetCompositingMode", "ptr", pGraphics, "int", 1) ; Overwrite/SourceCopy.
    DllCall("gdiplus\GdipSetInterpolationMode", "ptr", pGraphics, "int", 7) ; HighQualityBicubic

    ; Draw Image.
    DllCall("gdiplus\GdipCreateImageAttributes", "ptr*", &ImageAttr := 0)
    DllCall("gdiplus\GdipSetImageAttributesWrapMode", "ptr", ImageAttr, "int", 3) ; WrapModeTileFlipXY
    DllCall("gdiplus\GdipDrawImageRectRectI"
      , "ptr", pGraphics
      , "ptr", pBitmap
      , "int", 0, "int", 0, "int", safe_w, "int", safe_h ; destination rectangle
      , "int", 0, "int", 0, "int", width, "int", height ; source rectangle
      , "int", 2
      , "ptr", ImageAttr
      , "ptr", 0
      , "ptr", 0)
    DllCall("gdiplus\GdipDisposeImageAttributes", "ptr", ImageAttr)

    ; Clean up the graphics context.
    DllCall("gdiplus\GdipDeleteGraphics", "ptr", pGraphics)
    DllCall("gdiplus\GdipDisposeImage", "ptr", pBitmap)

    return pBitmap := pBitmapScale
  }
  ;关闭GDI+
  static close()
  {
    If (this.GdipToken) {
      DllCall("gdiplus\GdiplusShutdown", "UInt", this.GdipToken)
    }
    DllCall("FreeLibrary", "ptr", DllCall("GetModuleHandle", "str", "gdiplus", "ptr"))
  }
}
;----------------------------------------------------------------------------------------------------------image GDI+工具类
;----------------------------------------------------------------------------------------------------------JSON工具类
;可以用于把comobject对象转换为ahk对象
class JSON2
{
  static uuidA := "0763C49802734108979739D89C0CC7A4" . A_NowUTC
  static uuidB := "C8C0655017FB428FB18EECF88E6E85CF" . A_NowUTC
  static uuidC := "08E3043B62324D0C8BDDB6A2A1DB4E6A" . A_NowUTC
  ;解析json
  static parse(str)
  {
    str := inStr(str, '\\') ? strReplace(str, '\\', this.uuidC) : str ;替换 \\
    str := inStr(str, '\"') ? strReplace(str, '\"', this.uuidA) : str ;替换 \"
    str := inStr(str, "'") ? strReplace(str, "'", this.uuidB) : str   ;替换 '
    return this.recurve(str)
  }
  ;Func 把对象转换为字符串
  static stringify(obj)
  {
    return this.GetJS().JSON.stringify(obj)
  }
  ;递归解析json
  static recurve(str, recFlag := 0)
  {
    static eval := ObjBindMethod(this.GetJS(), 'eval')
    if not recFlag {
      obj := eval(Format('(function(){obj=JSON.parse({1}{2}{3});tmp=obj.length?"":obj["keys"]=Object.keys(obj);return obj})()'
        , "'", str, "'"))
      return this.recurve(obj, 1)
    }
    if (type(str) == "ComObject") {
      if (str.hasOwnProperty("length")) { ;数组
        tmpArr := []
        Loop str.length {
          if type(value := str.%A_index - 1%) == "ComObject"
            tmpArr.push(this.recurve(this.recurve(this.stringify(value), 0), 1))
          else
            tmpArr.push(this.recurve(value, 1))
        }
        return tmpArr
      } else {  ;对象 注意js的下标是0开始
        tmpObject := {}
        Loop str.keys.length {
          key := str.keys.%A_index - 1%
          if type(value := str.%key%) == "ComObject" {
            tmpObject.%key% := this.recurve(this.recurve(this.stringify(value), 0), 1)
          } else
            tmpObject.%key% := this.recurve(value, 1) ;
        }
        return tmpObject
      }
    } else { ;普通类型,可能是已经组装好的map或者是组装好的array
      ;            msgBox type(str)
      if type(str) == "Object" or type(str) == "Array"
        return str
      str := inStr(str, this.uuidA) ? strReplace(str, this.uuidA, '"') : str
      str := inStr(str, this.uuidB) ? strReplace(str, this.uuidB, "'") : str
      str := inStr(str, this.uuidC) ? strReplace(str, this.uuidC, "\") : str
      return str
    }
  }
  ;获取JS对象
  static GetJS() {
    static document := '', JS
    if !document {
      document := ComObject('HTMLFILE')
      document.write('<meta http-equiv="X-UA-Compatible" content="IE=9">')
      JS := document.parentWindow
      (document.documentMode < 9 && JS.execScript())
    }
    return JS
  }
}
;----------------------------------------------------------------------------------------------------------JSON工具类
;++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ak工具类class
class ak {
  static clipdataType := 1
  ;判断是否连接互联网
  static ConnectedToInternet(flag := 0x40) {
    Return DllCall("Wininet.dll\InternetGetConnectedState", "Str", flag, "Int", 0)
  }
  ;Func 显示网页 WB:activeX句柄 ,content:html内容,path:文件位置,timeout:=300
  static display(WB, content := "", path := "", timeout := 300)
  {
    if not content and not path
      throw Error("展示html时content和path同时为空")
    WB.silent := true
    if (content and not path and count := 1) {
      while (FileExist(f := Format("{1}\{2}{3}-tmp{4}DELETEME.html", A_Temp, A_TickCount, A_NowUTC, count)))
        count += 1
      FileAppend content, f
    } else if (path and not content)
      f := path
    WB.Navigate("file://" . f)
    while ((WB.readystate != 4) and --timeout > 0)
      sleep 10
    return true
  }

  ;Func 处理在屏幕上显示的位置,返回图像所在x,y
  static dealshowGui(x, y, w, h, &newX, &newY, gap := 5)
  {
    newX := x + w > A_ScreenWidth - gap ? A_ScreenWidth - gap - w : x ;处理右边界
    newY := y + h > A_ScreenHeight - 20 ? y - 20 - h : y ;处理下边界
  }
  ;Func frameShadow 窗口阴影
  static frameShadow(HGui)
  {
    _MARGINS := Buffer(16)
    NumPut("UInt", 0, _MARGINS, 0), NumPut("UInt", 0, _MARGINS, 4), NumPut("UInt", 1, _MARGINS, 8), NumPut("UInt", 0, _MARGINS, 12)
    DllCall("dwmapi\DwmSetWindowAttribute", "Ptr", HGui, "UInt", 2, "Int*", 2, "UInt", 4)
    DllCall("dwmapi\DwmExtendFrameIntoClientArea", "Ptr", HGui, "Ptr", _MARGINS)
  }
  ;Func 获取请求头中的数据返回一个obj对象传入一个请求头 map={a:{value:"hello",path:"/" , expires:"Sun, 22 Jan 2023 03:46:59 GMT",size:n},xx:"xxx"}
  static getHeaderObj(header)
  {
    resobj := {}, cookieobj := {}, size := 0
    Loop parse, header, "`n" {
      if A_loopField and index := inStr(A_loopField, ":") {
        key := trim(subStr(A_loopField, 1, index - 1))
        value := trim(subStr(A_loopField, index + 1))
        if (key == "Set-Cookie") {
          lineobj := {}, cookieKey := ""
          for v in strSplit(value, ";") {
            if indexb := inStr(v, "=") {
              a := trim(subStr(v, 1, indexb - 1))
              b := trim(subStr(v, indexb + 1))
              A_index == 1 ? ((lineobj.value := b) and (cookieKey := a)) : (lineobj.%a% := b)
            }
          }
          cookieobj.%cookieKey% := lineobj
          size += 1
        }
        cookieobj.size := size
        resobj.%key% := value
      }
    }
    resobj.cookie := cookieobj
    return resobj
  }
  ;Func 获取时间戳
  static getTimeStamp() {
    ; datediff 计算现在的utc时间到unix时间戳的起始时间经过的秒数
    return DateDiff(A_NowUTC, '19700101000000', 'S') * 1000 + A_MSec
  }
}