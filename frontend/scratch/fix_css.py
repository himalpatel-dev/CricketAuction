import os

filepath = r'f:\Project\Cricket Auction\CricketAuction\frontend\src\app\components\player-registration\player-registration.css'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove the last line if it's just a brace and there's a brace before it
if lines[-1].strip() == '}' and lines[-3].strip() == '}':
    # Check if lines[-2] is empty
    if lines[-2].strip() == '':
        print("Found extra brace, removing last two lines...")
        lines = lines[:-2]

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Done.")
