@echo off
set "OPENCLAW_WINDOWS_HEALTH_RUNTIME_DIR=C:\ProgramData\OpenClaw\Platform-Core\runtime"
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\ProgramData\OpenClaw\Platform-Core\platform-core-windows-health.ps1" -Loop -IntervalSeconds 30
