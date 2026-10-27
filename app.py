import os
import html
import json
import time
import queue
import requests
from threading import Thread, Lock
from datetime import datetime, timezone
from flask import Flask, render_template, Response
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
BASE_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

# Store messages, screen state and SSE clients
messages = []
clients = []
clients_lock = Lock()

MAX_MESSAGES = 50
HEARTBEAT_SECONDS = 15

THEMES = ["party", "neon", "matrix", "love", "retro", "alert", "chill"]
EFFECTS = ["confetti", "shake", "flash", "fireworks", "disco"]
PRANKS = ["bsod", "update", "hacked", "virus", "lottery"]

state = {
    "theme": "party",
    "names": False,  # prank mode: hide who sent the message
    "speak": False,  # read new messages aloud
}

HELP_TEXT = (
    "🎪 <b>Live Display Bot</b>\n\n"
    "Send any text → it pops up on screen\n\n"
    "<b>Themes</b> (/theme name)\n"
    + ", ".join(THEMES) + "\n\n"
    "<b>Effects</b>\n"
    "/confetti /shake /flash /fireworks /disco\n"
    "/rain 🍕 → emoji rain (any emoji)\n"
    "/countdown 10 → big countdown\n\n"
    "<b>Pranks</b> (send /calm to end)\n"
    "/bsod → fake crash screen\n"
    "/update → fake system update\n"
    "/hacked → you've been hacked\n"
    "/virus → fake virus scan\n"
    "/lottery → you won!\n\n"
    "<b>Settings</b>\n"
    "/names → show/hide sender names\n"
    "/speak → read messages aloud on/off\n"
    "/clear → clear the screen\n"
    "/status → current settings"
)


def telegram_poll():
    """Poll Telegram for new messages."""

    last_update_id = 0

    # Flush old messages
    try:
        resp = requests.get(
            f"{BASE_URL}/getUpdates",
            params={"timeout": 0},
            timeout=10
        ).json()

        if resp.get("ok") and resp.get("result"):
            last_update_id = resp["result"][-1]["update_id"] + 1
    except Exception:
        pass

    while True:
        try:
            resp = requests.get(
                f"{BASE_URL}/getUpdates",
                params={
                    "offset": last_update_id,
                    "timeout": 10
                },
                timeout=20
            ).json()

            if not resp.get("ok"):
                time.sleep(3)
                continue

            for update in resp.get("result", []):
                last_update_id = update["update_id"] + 1
                msg = update.get("message", {})
                text = msg.get("text", "")
                chat_id = str(msg.get("chat", {}).get("id", ""))
                name = msg.get("from", {}).get("first_name", "Unknown")

                if chat_id != CHAT_ID or not text:
                    continue

                reply = handle_text(text, name)
                if reply:
                    send_reply(reply)

        except Exception:
            time.sleep(3)


def handle_text(text, name):
    """Apply one incoming message to the screen. Returns the bot's reply."""

    stripped = text.strip()

    if not stripped.startswith("/"):
        return show_message(text, name)

    parts = stripped.split(maxsplit=1)
    # "/theme@SomeBot neon" → "theme"
    command = parts[0][1:].split("@")[0].lower()
    arg = parts[1].strip() if len(parts) > 1 else ""

    if command in ("help", "start"):
        return HELP_TEXT

    if command == "clear":
        messages.clear()
        broadcast({"type": "clear"})
        return "🧹 Screen cleared!"

    if command == "theme":
        theme = arg.lower()
        if theme not in THEMES:
            return "🎨 Pick one: " + ", ".join(THEMES)
        state["theme"] = theme
        broadcast({"type": "state", "data": state})
        return f"🎨 Theme → {theme}"

    if command in THEMES:
        state["theme"] = command
        broadcast({"type": "state", "data": state})
        return f"🎨 Theme → {command}"

    if command in EFFECTS:
        broadcast({"type": "effect", "name": command})
        return f"✨ {command}!"

    if command == "rain":
        emoji = arg[:8] or "🎉"
        broadcast({"type": "effect", "name": "rain", "arg": emoji})
        return f"🌧 Raining {emoji}"

    if command == "countdown":
        try:
            seconds = max(1, min(int(arg or 10), 99))
        except ValueError:
            return "⏱ Usage: /countdown 10"
        broadcast({"type": "effect", "name": "countdown", "arg": seconds})
        return f"⏱ Counting down from {seconds}"

    if command in PRANKS:
        broadcast({"type": "prank", "name": command})
        return f"😈 {command} is on screen. /calm to end it"

    if command == "calm":
        broadcast({"type": "prank", "name": None})
        return "😇 Back to normal"

    if command in ("names", "speak"):
        state[command] = not state[command]
        broadcast({"type": "state", "data": state})
        return f"⚙️ {command}: {'on' if state[command] else 'off'}"

    if command == "status":
        return (
            f"📺 Theme: {state['theme']}\n"
            f"Names: {'on' if state['names'] else 'off'}\n"
            f"Speak: {'on' if state['speak'] else 'off'}\n"
            f"Messages: {len(messages)}\n"
            f"Screens watching: {len(clients)}"
        )

    return "🤔 Unknown command. Try /help"


def show_message(text, name):
    """Store a message and push it to every screen."""

    entry = {
        "text": text,
        "sender": name,
        "time": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "timestamp": time.time()
    }

    messages.append(entry)

    if len(messages) > MAX_MESSAGES:
        messages.pop(0)

    broadcast({"type": "message", "data": entry})

    return f"✅ Displayed: {html.escape(text[:50])}"


def send_reply(text):
    """Send a reply in Telegram."""

    try:
        requests.post(
            f"{BASE_URL}/sendMessage",
            json={
                "chat_id": CHAT_ID,
                "text": text,
                "parse_mode": "HTML"
            },
            timeout=10
        )
    except Exception:
        pass


def broadcast(data):
    """Send data to all SSE clients."""

    with clients_lock:
        for q in clients:
            q.put_nowait(data)


@app.route("/")
def index():
    return render_template(
        "index.html",
        messages=messages[-6:],
        state=state,
        themes=THEMES
    )


@app.route("/stream")
def stream():
    """SSE endpoint for live updates."""

    def event_stream():
        q = queue.Queue()
        with clients_lock:
            clients.append(q)

        try:
            while True:
                try:
                    data = q.get(timeout=HEARTBEAT_SECONDS)
                except queue.Empty:
                    # Writing to a closed connection raises, which is how
                    # screens that went away get dropped
                    yield ": ping\n\n"
                    continue
                yield f"data: {json.dumps(data)}\n\n"
        finally:
            with clients_lock:
                if q in clients:
                    clients.remove(q)

    return Response(
        event_stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


if __name__ == "__main__":
    # Start Telegram polling in background
    if BOT_TOKEN:
        t = Thread(target=telegram_poll, daemon=True)
        t.start()

    print("Live Display running on http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
