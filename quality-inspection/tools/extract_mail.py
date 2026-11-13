#!/usr/bin/env python3
"""Usage: python3 -I extract_mail.py raw_message.json out_dir  - saves the attachments of a Gmail RAW message (JSON with a "raw" field)."""
import sys, json, base64, email, os
from email import policy
src, out = sys.argv[1], sys.argv[2]
raw = json.load(open(src))['raw']; raw += '=' * (-len(raw) % 4)
msg = email.message_from_bytes(base64.urlsafe_b64decode(raw), policy=policy.default)
for part in msg.walk():
    fn = part.get_filename()
    if fn:
        name = os.path.basename(fn).replace('/', '_'); open(os.path.join(out, name), 'wb').write(part.get_payload(decode=True)); print('saved', name)
