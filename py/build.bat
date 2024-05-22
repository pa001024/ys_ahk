pyinstaller autocook.py --noconfirm
xcopy dist_copy\cnocr dist\autocook\_internal\cnocr\ /s /y
copy ok.png dist\autocook\ok.png
copy autocook.ini dist\autocook\autocook.ini