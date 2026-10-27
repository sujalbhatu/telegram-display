import os
import json
import time
import queue
import requests
from threading import Thread
from datetime import datetime
from flask import Flask, render_template, Response
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
BASE_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

# Store messages and SSE clients
messages = []
clients = []

MAX_MESSAGES = 50


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
                sender = msg.get("from", {})
                name = sender.get("first_name", "Unknown")

                if chat_id != CHAT_ID:
                    continue

                if not text:
                    continue

                # Handle /clear command
                if text.strip().lower() == "/clear":
                    messages.clear()
                    broadcast({"type": "clear"})
                    send_reply("🧹 Screen cleared!")
                    continue

                # Handle /help command
                if text.strip().lower() in ("/help", "/start"):
                    send_reply(
                        "📺 <b>Live Display Bot</b>\n\n"
                        "Send any text → appears on screen\n"
                        "/clear → Clear the screen\n"
                        "/help → Show this message"
                    )
                    continue

                # Store message
                entry = {
                    "text": text,
                    "sender": name,
                    "time": datetime.utcnow().strftime("%H:%M:%S"),
                    "timestamp": time.time()
                }

                messages.append(entry)

                if len(messages) > MAX_MESSAGES:
                    messages.pop(0)

                # Broadcast to all connected clients
                broadcast({"type": "message", "data": entry})

                # Confirm in Telegram
                send_reply(f"✅ Displayed: {text[:50]}")

        except Exception:
            time.sleep(3)


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

    dead = []

    for q in clients:
        try:
            q.put_nowait(data)
        except Exception:
            dead.append(q)

    for q in dead:
        clients.remove(q)


@app.route("/")
def index():
    return render_template("index.html", messages=messages)


@app.route("/stream")
def stream():
    """SSE endpoint for live updates."""

    def event_stream():
        q = queue.Queue()
        clients.append(q)

        try:
            while True:
                data = q.get()
                yield f"data: {json.dumps(data)}\n\n"
        except GeneratorExit:
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
    t = Thread(target=telegram_poll, daemon=True)
    t.start()

    print("Live Display running on http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
