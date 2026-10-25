#!/usr/bin/env python3
import os
key = '[REDACTED-ROTATED]'
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d != '.git']
    for f in files:
        if f.endswith('.pptx') or f.endswith('.png') or f.endswith('.jpg'):
            continue
        path = os.path.join(root, f)
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
            if key in content:
                content = content.replace(key, '[REDACTED-ROTATED]')
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(content)
        except:
            pass
