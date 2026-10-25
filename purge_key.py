import os, sys
for root, dirs, files in os.walk('.'):
    # Skip .git directory
    dirs[:] = [d for d in dirs if d != '.git']
    for f in files:
        if f.endswith('.pptx') or f.endswith('.png') or f.endswith('.jpg'):
            continue
        path = os.path.join(root, f)
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
            if '[REDACTED-ROTATED]' in content:
                content = content.replace('[REDACTED-ROTATED]', '[REDACTED-ROTATED]')
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(content)
                print('REPLACED:', path)
        except Exception as e:
            pass
