# Travel Security Dashboard

A full-stack travel security management application built with Python, Flask, SQLite, and D3.js.

## Features

- **Interactive 3D Globe** — D3.js orthographic globe with country-level color coding by traveler count
- **Real-time Data** — Countries color coded by number of current travelers, with hover tooltips
- **Traveler Panel** — Click any country to see current travelers, upcoming travel dropdown, and denied travel
- **Auto-rotation** — Globe smoothly rotates to center on any clicked country
- **Travel Roster** — Spreadsheet-style table with search, filter, and sort
- **Approval Workflow** — Awaiting Approval, Travel Roster, and Historic tabs
- **Traveler Management** — Add, edit, approve, deny, and delete travelers
- **Contact Information** — Primary (in-country), in-country contact, and emergency contact per traveler

## Tech Stack

- **Backend:** Python, Flask, SQLite
- **Frontend:** D3.js, TopoJSON, Vanilla JavaScript, HTML/CSS
- **Database:** SQLite with JSON data loading script

## Setup

1. Install dependencies:
```bash
pip3 install flask
```

2. Initialize the database:
```bash
python3 << 'DBEOF'
import json, sqlite3
from datetime import date

conn = sqlite3.connect('travel_security.db')
cursor = conn.cursor()
cursor.execute('''
    CREATE TABLE IF NOT EXISTS travelers (
        id INTEGER PRIMARY KEY,
        country TEXT,
        first_name TEXT,
        last_name TEXT,
        travel_start TEXT,
        travel_end TEXT,
        passport_number TEXT,
        travel_approved INTEGER,
        itinerary_link TEXT,
        primary_contact_label TEXT,
        primary_contact_value TEXT,
        secondary_contact_name TEXT,
        secondary_contact_phone TEXT,
        secondary_contact_relationship TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        emergency_contact_relationship TEXT,
        status TEXT DEFAULT 'active'
    )
''')
conn.commit()
conn.close()
print('Database created.')
DBEOF
```

3. Run the app:
```bash
python3 app.py
```

4. Open your browser to `http://127.0.0.1:5000`

## Project Structure
```
travel_security/
├── data/
│   └── travelers.json        # Traveler data
├── static/
│   ├── css/
│   │   ├── style.css         # Global styles
│   │   ├── form.css          # Add traveler form styles
│   │   └── roster.css        # Roster table styles
│   └── js/
│       └── globe.js          # D3 globe and panel logic
├── templates/
│   ├── index.html            # Globe page
│   ├── form.html             # Add/edit traveler form
│   └── roster.html           # Roster table
├── app.py                    # Flask backend and API routes
├── init_db.py                # Database initialization script
└── README.md
```
