Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\UserFolders\Desktop\PROJECTS 2026\DesktopDrawer"
WshShell.Run "cmd /c npm start", 0, False
