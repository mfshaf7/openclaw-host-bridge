@echo off
"%SystemRoot%\System32\wscript.exe" //B //NoLogo //E:JScript "%~dp0launch-platform-core-windows-health.js"
exit /b %errorlevel%
