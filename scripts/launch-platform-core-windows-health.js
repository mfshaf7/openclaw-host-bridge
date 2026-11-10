// Windows Script Host entry point, not a Node.js module. The GUI host creates
// the monitor's hidden console before PowerShell or WSL can request a terminal.
var shell = new ActiveXObject("WScript.Shell");
var fs = new ActiveXObject("Scripting.FileSystemObject");
var environment = shell.Environment("Process");
var runtime = environment("OPENCLAW_WINDOWS_HEALTH_RUNTIME_DIR") || "C:\\ProgramData\\OpenClaw\\Platform-Core\\runtime";

try {
  if (!fs.FolderExists(runtime)) fs.CreateFolder(runtime);
  var script = fs.BuildPath(fs.GetParentFolderName(WScript.ScriptFullName), "platform-core-windows-health.ps1");
  if (!fs.FileExists(script)) throw new Error("Installed Windows health script is missing");
  environment("OPENCLAW_WINDOWS_HEALTH_RUNTIME_DIR") = runtime;
  var system = shell.ExpandEnvironmentStrings("%SystemRoot%") + "\\System32";
  var command = '"' + system + '\\cmd.exe" /d /s /c ""' + system + '\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + script + '" -Loop -IntervalSeconds 30 1>>"' + fs.BuildPath(runtime, "windows-health-stdout.log") + '" 2>>"' + fs.BuildPath(runtime, "windows-health-stderr.log") + '""';
  shell.Run(command, 0, false);
} catch (error) {
  try {
    var log = fs.OpenTextFile(fs.BuildPath(runtime, "windows-health-launcher.log"), 8, true);
    log.WriteLine(new Date().toUTCString() + " " + error.message);
    log.Close();
  } catch (ignored) {}
  WScript.Quit(1);
}
