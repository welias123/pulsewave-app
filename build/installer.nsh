; ── Pulsewave NSIS custom script ─────────────────────────────────────────────
; Adds Windows Defender exclusion for install dir so it doesn't block the app

!macro customInstall
  ; Add Windows Defender exclusion for the install directory
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Add-MpPreference -ExclusionPath \"$INSTDIR\" -ErrorAction SilentlyContinue"'
  ; Also exclude the AppData cache folder (where yt-dlp stores temp files)
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Add-MpPreference -ExclusionPath \"$APPDATA\Pulsewave\" -ErrorAction SilentlyContinue"'
!macroend

!macro customUnInstall
  ; Remove exclusions on uninstall
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Remove-MpPreference -ExclusionPath \"$INSTDIR\" -ErrorAction SilentlyContinue"'
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Remove-MpPreference -ExclusionPath \"$APPDATA\Pulsewave\" -ErrorAction SilentlyContinue"'
!macroend
