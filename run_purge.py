#!/usr/bin/env python3
# Run this directly (not via filter-branch tree-filter reference)
import os, sys
key = '[REDACTED-ROTATED]'
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d != '.git' and d != '.git-rewrite']
    for f in files:
        p = os.path.join(root, f)
        if f.endswith('.pptx') or f.endswith('.png') or f.endswith('.jpg') or f.endswith('.gif'):
            continue
        try:
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
            if key in content:
                content = content.replace(key, '[REDACTED-ROTATED]')
                with open(p, 'w', encoding='utf-8') as file:
                    file.write(content)
                print('REPLACED:', p)
        except:
            pass
