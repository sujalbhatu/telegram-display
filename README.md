# Telegram Live Display

Send a message to a Telegram bot and it appears, in big text, on a web page in real time. Put the page on a TV or projector and anyone in the chat can write to the screen.

Live at **[display.openforge.online](https://display.openforge.online)**.

## How it works

- `app.py` is a small Flask app. A background thread long-polls the Telegram Bot API (`getUpdates`) and only accepts messages from one chat (`TELEGRAM_CHAT_ID`).
- Each new message is kept in memory (last 50) and pushed to every open browser over **Server-Sent Events** (`GET /stream`).
- `GET /` renders the page with the messages so far; the page's JavaScript appends new ones as they arrive and reconnects if the stream drops.

### Bot commands

| Command | What it does |
| --- | --- |
| any text | Shows it on the screen |
| `/clear` | Clears the screen |
| `/help`, `/start` | Shows the commands |

## Run it

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in your bot token and chat id
python app.py                   # http://127.0.0.1:5000
```

Get a bot token from [@BotFather](https://t.me/BotFather). To find your chat id, send the bot a message and open `https://api.telegram.org/bot<TOKEN>/getUpdates`.

## Deploy

`telegram-display.service` is the systemd unit used in production. Nginx proxies the domain to `127.0.0.1:5000`; for the stream to work, turn buffering off for that location (`proxy_buffering off;`).
