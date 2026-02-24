from flask import Flask, jsonify, render_template, request
import sqlite3
from datetime import date

app = Flask(__name__)

def get_db():
    conn = sqlite3.connect("travel_security.db")
    conn.row_factory = sqlite3.Row
    return conn

def row_to_dict(row):
    return {
        "id": row["id"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "country": row["country"],
        "travel_start": row["travel_start"],
        "travel_end": row["travel_end"],
        "passport_number": row["passport_number"],
        "travel_approved": bool(row["travel_approved"]),
        "itinerary_link": row["itinerary_link"],
        "status": row["status"],
        "contacts": {
            "primary": {"label": row["primary_contact_label"], "value": row["primary_contact_value"]},
            "secondary": {"name": row["secondary_contact_name"], "phone": row["secondary_contact_phone"], "relationship": row["secondary_contact_relationship"]},
            "emergency": {"name": row["emergency_contact_name"], "phone": row["emergency_contact_phone"], "relationship": row["emergency_contact_relationship"]}
        }
    }

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/form")
def form():
    return render_template("form.html")

@app.route("/form/<int:traveler_id>")
def form_edit(traveler_id):
    return render_template("form.html", traveler_id=traveler_id)

@app.route("/roster")
def roster():
    return render_template("roster.html")

@app.route("/api/countries")
def countries():
    today = date.today().isoformat()
    conn = get_db()
    current = conn.execute("SELECT country, COUNT(*) as count FROM travelers WHERE travel_start <= ? AND travel_end >= ? AND status = 'active' GROUP BY country", (today, today)).fetchall()
    planned = conn.execute("SELECT country, COUNT(*) as count FROM travelers WHERE travel_start > ? AND status = 'active' GROUP BY country", (today,)).fetchall()
    conn.close()
    current_dict = {row["country"]: row["count"] for row in current}
    planned_dict = {row["country"]: row["count"] for row in planned}
    all_countries = set(list(current_dict.keys()) + list(planned_dict.keys()))
    result = [{"country": c, "current": current_dict.get(c, 0), "planned": planned_dict.get(c, 0)} for c in all_countries]
    return jsonify(result)

@app.route("/api/travelers/all")
def all_travelers():
    conn = get_db()
    rows = conn.execute("SELECT * FROM travelers WHERE status = 'active' ORDER BY travel_start ASC").fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/travelers/pending")
def pending_travelers():
    conn = get_db()
    rows = conn.execute("SELECT * FROM travelers WHERE status = 'pending' ORDER BY travel_start ASC").fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/travelers/historic")
def historic_travelers():
    conn = get_db()
    rows = conn.execute("SELECT * FROM travelers WHERE status = 'historic' ORDER BY travel_end DESC").fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/travelers/get/<int:traveler_id>")
def get_traveler(traveler_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM travelers WHERE id = ?", (traveler_id,)).fetchone()
    conn.close()
    if row:
        return jsonify(row_to_dict(row))
    return jsonify({"error": "Not found"}), 404

@app.route("/api/travelers/add", methods=["POST"])
def add_traveler():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO travelers (
            country, first_name, last_name, travel_start, travel_end,
            passport_number, travel_approved, itinerary_link,
            primary_contact_label, primary_contact_value,
            secondary_contact_name, secondary_contact_phone, secondary_contact_relationship,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
            status
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        data["country"], data["first_name"], data["last_name"],
        data["travel_start"], data["travel_end"],
        data["passport_number"], 1 if data["travel_approved"] else 0,
        data.get("itinerary_link", ""),
        data["primary_contact_label"], data["primary_contact_value"],
        data["secondary_contact_name"], data["secondary_contact_phone"], data["secondary_contact_relationship"],
        data["emergency_contact_name"], data["emergency_contact_phone"], data["emergency_contact_relationship"],
        "pending"
    ))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return jsonify({"success": True, "id": new_id})

@app.route("/api/travelers/edit/<int:traveler_id>", methods=["POST"])
def edit_traveler(traveler_id):
    data = request.json
    conn = get_db()
    conn.execute("""
        UPDATE travelers SET
            country=?, first_name=?, last_name=?, travel_start=?, travel_end=?,
            passport_number=?, travel_approved=?, itinerary_link=?,
            primary_contact_label=?, primary_contact_value=?,
            secondary_contact_name=?, secondary_contact_phone=?, secondary_contact_relationship=?,
            emergency_contact_name=?, emergency_contact_phone=?, emergency_contact_relationship=?
        WHERE id=?
    """, (
        data["country"], data["first_name"], data["last_name"],
        data["travel_start"], data["travel_end"],
        data["passport_number"], 1 if data["travel_approved"] else 0,
        data.get("itinerary_link", ""),
        data["primary_contact_label"], data["primary_contact_value"],
        data["secondary_contact_name"], data["secondary_contact_phone"], data["secondary_contact_relationship"],
        data["emergency_contact_name"], data["emergency_contact_phone"], data["emergency_contact_relationship"],
        traveler_id
    ))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/travelers/approve/<int:traveler_id>", methods=["POST"])
def approve_traveler(traveler_id):
    conn = get_db()
    conn.execute("UPDATE travelers SET status='active', travel_approved=1 WHERE id=?", (traveler_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/travelers/deny/<int:traveler_id>", methods=["POST"])
def deny_traveler(traveler_id):
    conn = get_db()
    conn.execute("UPDATE travelers SET status='active', travel_approved=0 WHERE id=?", (traveler_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/travelers/delete/<int:traveler_id>", methods=["POST"])
def delete_traveler(traveler_id):
    conn = get_db()
    conn.execute("DELETE FROM travelers WHERE id=?", (traveler_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/travelers/<country>")
def travelers_by_country(country):
    conn = get_db()
    rows = conn.execute("SELECT * FROM travelers WHERE country = ? AND status = 'active'", (country,)).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
