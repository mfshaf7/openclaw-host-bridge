#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit('usage: run_windows_command.py <payload-json>')

payload_path = Path(sys.argv[1])
payload = json.loads(payload_path.read_text(encoding='utf-8'))

with tempfile.NamedTemporaryFile(mode='w+', encoding='utf-8', delete=False) as stdout_file, tempfile.NamedTemporaryFile(mode='w+', encoding='utf-8', delete=False) as stderr_file:
    stdout_path = Path(stdout_file.name)
    stderr_path = Path(stderr_file.name)

try:
    with stdout_path.open('w', encoding='utf-8') as out_handle, stderr_path.open('w', encoding='utf-8') as err_handle:
        completed = subprocess.run(
            [str(payload['binary']), *[str(arg) for arg in payload.get('args', [])]],
            env=os.environ,
            stdin=subprocess.DEVNULL,
            stdout=out_handle,
            stderr=err_handle,
            text=True,
        )
    sys.stdout.write(stdout_path.read_text(encoding='utf-8'))
    sys.stderr.write(stderr_path.read_text(encoding='utf-8'))
    raise SystemExit(completed.returncode)
finally:
    stdout_path.unlink(missing_ok=True)
    stderr_path.unlink(missing_ok=True)
