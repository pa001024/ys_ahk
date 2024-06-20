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
  Sleep 200
  A_Clipboard := bak
}

req := comObject("WinHttp.WinHttpRequest.5.1")
httpRequest(url, method := "GET", headers := "", data := "", userAgent := "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36") {
  try {
    req.Open(method, url, true) ;true 表示异步
    req.SetRequestHeader("User-Agent", userAgent)
    req.Send()
    req.WaitForResponse()
  }
  catch {
    return ""
  }
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
class JSON {
  static parse(s) {
    static q := Chr(34)
      , op := ""
      , vMap := "Map"
      , vTrue := %vMap%("json_value", "true", "value", 1)
      , vFalse := %vMap%("json_value", "false", "value", 0)
      , vNull := %vMap%("json_value", "null", "value", "")
    static rep := [["\\", "\u005c"], ["\" q, q], ["\/", "/"]
      , ["\r", "`r"], ["\n", "`n"], ["\t", "`t"], ["\b", "`b"], ["\f", "`f"]]
    if !(p := RegExMatch(s, op "[{\[]", &r))
      return
    stack := [], result := []
      , arr := result, isArr := (r[0] = "["), key := (isArr ? 1 : ""), keyok := 0
    While p := RegExMatch(s, op "\S", &r, p + StrLen(r[0]))
    {
      Switch r[0]
      {
        Case "{", "[":
          r1 := []
          , (isArr && !keyok ? (arr.Push(r1), keyok := 1) : arr[key] := r1)
          , stack.Push(arr, isArr, key, keyok)
          , arr := r1, isArr := (r[0] = "["), key := (isArr ? 1 : ""), keyok := 0
        Case "}", "]":
          if stack.Length < 4
            Break
          keyok := stack.Pop(), key := stack.Pop()
            , isArr := stack.Pop(), arr := stack.Pop()
        Case ",":
          key := (isArr ? key + 1 : ""), keyok := 0
        Case ":":
          (!isArr && keyok := 1)
        Case q:
          i := p, re := op . q "[^" q "]*" q
          While (p := RegExMatch(s, re, &r, p + StrLen(r[0]) - 1))
            && SubStr(StrReplace(r[0], "\\"), -2, 1) = "\"
          { }  ; 用循环避免正则递归太深
          if !p
            Break
          r1 := SubStr(s, i + 1, p + StrLen(r[0]) - i - 2)
          if InStr(r1, "\")
          {
            For k, v in rep
              r1 := StrReplace(r1, v[1], v[2])
            v := "", k := 1
            While i := RegExMatch(r1, "i)\\u[0-9a-f]{4}", , k)
              v .= SubStr(r1, k, i - k) . Chr("0x" SubStr(r1, i + 2, 4)), k := i + 6
            r1 := v . SubStr(r1, k)
          }
          if (isArr or keyok)
            (isArr && !keyok ? (arr.Push(r1), keyok := 1) : arr[key] := r1)
          else key := r1
        Default:
          if RegExMatch(s, op "[^\s{}\[\],:" q "]+", &r, p) != p
            Break
          Try r1 := "", r1 := (r[0] == "true" ? vTrue : r[0] == "false" ? vFalse
            : r[0] == "null" ? vNull : r[0] + 0)
          (isArr && !keyok ? (arr.Push(r1), keyok := 1) : arr[key] := r1)
      }
    }
    return result
  }
  static stringify(obj, space := "")
  {
    static q := Chr(34)
      , op := ""
      , vType := "Type"
      , vIsNumber := "IsNumber"
    static rep := [["\\", "\"], ["\" q, q]
      ;-------------------
      ; 默认不替换 "/-->\/" 与 html特殊字符 "<、>、&-->\uXXXX"
      ; , ["\/","/"], ["\u003c","<"], ["\u003e",">"], ["\u0026","&"]
      ;-------------------
      , ["\r", "`r"], ["\n", "`n"], ["\t", "`t"], ["\b", "`b"], ["\f", "`f"]]
    if !IsObject(obj)
    {
      if %vIsNumber%(obj)
        return %vType%(obj) = "String" ? q . obj . q : obj
      for k, v in rep
        obj := StrReplace(obj, v[2], v[1])
      ;-------------------
      ; 默认不替换 "Unicode字符-->\uXXXX"
      ; While RegExMatch(obj, op "[^\x20-\x7e]", (V2 ? &r : r))
      ;   obj:=StrReplace(obj, r[0], Format("\u{:04x}",Ord(r[0])))
      ;-------------------
      return q . obj . q
    }
    isArr := 1
    for k, v in obj
      if (k != A_Index) and !(isArr := 0)
        break
    if (!isArr and obj.Count = 2) and obj.Has("json_value")
      and ((k := obj["json_value"]) == "true" or k == "false" or k == "null")
      return k
    s := "", NewSpace := space . "    ", f := A_ThisFunc
    For k, v in obj
      if !(k = "" or IsObject(k))
        s .= "`r`n" NewSpace
          . (isArr ? "" : %f%(k . "") ": ")
          . %f%(v, NewSpace) . ","
    s := Trim(s, ",") . "`r`n" space
    return isArr ? "[" s "]" : "{" s "}"
  }
}

ConnectedToInternet(flag := 0x40) {
  Return DllCall("Wininet.dll\InternetGetConnectedState", "Str", flag, "Int", 0)
}
getTimeStamp() {
  ; datediff 计算现在的utc时间到unix时间戳的起始时间经过的秒数
  return DateDiff(A_NowUTC, '19700101000000', 'S') * 1000 + A_MSec
}