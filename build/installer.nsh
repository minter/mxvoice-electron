; build/installer.nsh
; Custom NSIS include for electron-builder. Hooks into the install/uninstall
; lifecycle to invalidate Windows' shell icon cache after upgrade so the new
; embedded app icon actually shows up in Start Menu, taskbar, and Explorer.
;
; Without this, electron-updater's silent NSIS upgrade replaces the exe but
; Windows keeps serving the old cached icon (often the default Electron icon
; from a long-ago version), making it look like our build dropped the icon.

!macro customInstall
  DetailPrint "Refreshing Windows shell icon cache..."

  ; Notify the shell that associations/icons changed. Forces Explorer to
  ; re-read the icon from the freshly-written exe.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)' ; SHCNE_ASSOCCHANGED

  ; Ask ie4uinit to rebuild the per-user icon cache. Different Windows
  ; versions use different flags, so try the modern one first.
  nsExec::Exec '"$SYSDIR\ie4uinit.exe" -show'
  Pop $0
  ${If} $0 != "0"
    nsExec::Exec '"$SYSDIR\ie4uinit.exe" -ClearIconCache'
    Pop $0
  ${EndIf}
!macroend

!macro customUnInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
