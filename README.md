# Telegram Live Display

Send a message to a Telegram bot and it appears, in big text, on a web page in real time. Put the page on a TV or projector and anyone in the chat can write to the screen.

Live at **[display.openforge.online](https://display.openforge.online)**.

## How it works

- `app.py` is a small Flask app. A background thread long-polls the Telegram Bot API (`getUpdates`) and only accepts messages from one chat (`TELEGRAM_CHAT_ID`).
- Each new message is kept in memory (last 50) and pushed to every open browser over **Server-Sent Events** (`GET /stream`).
- `GET /` renders the page with the latest messages and the current theme; `static/app.js` applies new messages, themes, effects and pranks as events arrive, and reconnects if the stream drops.

### Bot commands

Any normal text pops up on the screen, sized to fit. Everything else is a slash command.

**Themes** — `/theme <name>` or just `/<name>`

| Theme | Look |
| --- | --- |
| `party` (default) | Rainbow background, balloons, 3D type, confetti on every message |
| `neon` | Synthwave sun and grid, glowing flicker, fireworks on every message |
| `matrix` | Falling green code, messages type themselves out |
| `love` | Pink, floating hearts, script type, heart shower on every message |
| `retro` | Amber CRT terminal with scanlines and a typewriter |
| `alert` | Red siren, hazard stripes, the screen shakes on every message |
| `chill` | Sunset gradient, stars and drifting clouds |

**Effects**

| Command | What it does |
| --- | --- |
| `/confetti`, `/fireworks` | Particle bursts |
| `/shake`, `/flash` | Shake or strobe the screen |
| `/disco` | Spinning lights and a rainbow colour cycle |
| `/rain 🍕` | Rains any emoji |
| `/countdown 10` | Giant countdown (1–99) that ends in a celebration |

**Pranks** — take over the whole screen; `/calm` ends them with a "GOTCHA!" reveal

| Command | What it shows |
| --- | --- |
| `/bsod` | A fake crash screen with a progress counter |
| `/update` | A fake system update that gets stuck at 99% |
| `/hacked` | "System compromised", a countdown and a silly hacker log |
| `/virus` | A fake virus scanner finding Trojan.RickRoll and friends |
| `/lottery` | "You won ₹10 crore!" — the claim button reveals the joke |

**Settings**

| Command | What it does |
| --- | --- |
| `/names` | Show or hide who sent each message (hidden by default) |
| `/speak` | Read new messages aloud |
| `/status` | Current theme, settings and how many screens are watching |
| `/clear` | Clears the screen |
| `/help`, `/start` | Shows all commands |

Browsers only play sound after someone interacts with the page, so tap the 🔇 button once on the display device.

The stream sends a keep-alive comment every 15 seconds so screens that disconnect are cleaned up.

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
