import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


ROOT = Path(__file__).resolve().parent.parent
SITE_ROOT = ROOT
load_dotenv(ROOT / ".env")

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
)

EMAIL_PATTERN = re.compile(r"[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+")


@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store" if request.path.startswith("/api/") else "public, max-age=300"
    return response


@app.get("/")
def index():
    return send_from_directory(SITE_ROOT, "index.html")


@app.get("/api/health")
def health():
    return jsonify(ok=True)


@app.get("/api/contact/config")
def contact_config():
    contact_email = os.getenv("CONTACT_TO", "").strip()
    if contact_email.lower() == "your-address@gmail.com":
        contact_email = ""
    return jsonify(contactEmail=contact_email)


@app.get("/css/<path:asset_path>")
def stylesheet(asset_path):
    return send_from_directory(SITE_ROOT / "css", asset_path)


@app.get("/js/<path:asset_path>")
def javascript(asset_path):
    return send_from_directory(SITE_ROOT / "js", asset_path)


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify(error="Message is too large."), 413


@app.errorhandler(429)
def too_many_requests(_error):
    return jsonify(error="Please wait before sending another message."), 429


@app.post("/api/contact")
@limiter.limit("3 per hour")
def contact():
    origin = request.headers.get("Origin")
    if origin and urlparse(origin).netloc.lower() != request.host.lower():
        return jsonify(error="Request origin is not allowed."), 403

    if not request.is_json:
        return jsonify(error="Expected a JSON message."), 415

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error="Invalid message."), 400

    if data.get("website"):
        return jsonify(ok=True), 200

    name = data.get("name")
    reply_to = data.get("email")
    body = data.get("message")
    if not all(isinstance(value, str) for value in (name, reply_to, body)):
        return jsonify(error="Name, email, and message are required."), 400

    name = name.strip()
    reply_to = reply_to.strip()
    body = body.strip()
    if not name or len(name) > 120 or any(ord(char) < 32 for char in name):
        return jsonify(error="Enter a valid name."), 400
    if len(reply_to) > 254 or not EMAIL_PATTERN.fullmatch(reply_to):
        return jsonify(error="Enter a valid reply email address."), 400
    if not body or len(body) > 3000:
        return jsonify(error="Message must be between 1 and 3000 characters."), 400

    smtp_host = os.getenv("SMTP_HOST")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    contact_from = os.getenv("CONTACT_FROM") or smtp_username
    contact_to = os.getenv("CONTACT_TO")
    if not all((smtp_host, smtp_username, smtp_password, contact_from, contact_to)):
        app.logger.error("Contact email settings are incomplete.")
        return jsonify(error="Message service is not configured yet."), 503

    message = EmailMessage()
    message["Subject"] = "New portfolio message"
    message["From"] = contact_from
    message["To"] = contact_to
    message["Reply-To"] = reply_to
    message.set_content(f"Name: {name}\nReply address: {reply_to}\n\n{body}")

    try:
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
        context = ssl.create_default_context()
        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15, context=context) as server:
                server.login(smtp_username, smtp_password)
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(smtp_username, smtp_password)
                server.send_message(message)
    except (OSError, ValueError, smtplib.SMTPException):
        app.logger.exception("Could not deliver portfolio contact message.")
        return jsonify(error="Message could not be delivered. Please try again later."), 502

    return jsonify(ok=True), 200


if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        debug=False,
    )