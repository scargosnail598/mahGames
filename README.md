# Starfall Squadron: Neon Ronin

A mouse-only vertical arcade shooter with solo play and a simple two-player online co-op mode.

## Co-op MVP

- One player creates a private five-letter room code.
- The second player opens the same site and joins with that code.
- Both ships use mouse steering and automatic fire.
- Each pilot chooses one of four visually distinct fighters; duplicate picks are automatically separated.
- Enemies, score, combo, pickups, boss and Pulse energy are shared.
- Each pilot has separate hull, shield and temporary power-ups. The HUD shows the wingmate's hull.
- The room creator runs the authoritative game simulation. The Node server relays the second pilot's input and sends snapshots back at 20 Hz. The guest renders at display refresh rate with local movement prediction, entity interpolation, projectile extrapolation and gradual authoritative correction.
- State packets carry stable entity IDs and monotonic sequence numbers. Old packets are ignored, WebSocket backpressure drops replaceable snapshots, and the co-op badge shows measured guest control latency.

This first version supports exactly two players per room. Rooms are held in memory and disappear when either player disconnects or after six hours. There are no accounts, public room lists, matchmaking or persistent scores.

## Run locally

Node.js 22 or newer is the only requirement. The WebSocket server has no npm dependencies.

```bash
npm start
```

Open `http://localhost:8080` in two browser windows. Create a room in the first and join it from the second.

## Install with Docker Compose

```bash
git clone https://github.com/scargosnail598/mahGames.git
cd mahGames
docker compose up -d --build
curl http://127.0.0.1:8080/healthz
```

The compose file publishes the game on `0.0.0.0:8080`, so an external reverse proxy or ArvanCloud can reach the origin through the server's public IP. WebSocket connections use the same public hostname and `/ws` path.

For ArvanCloud, set the origin to the server IP on port `8080`, enable WebSocket support, and allow TCP `8080` through the server firewall. Set `ALLOWED_ORIGIN` in `compose.yaml` to the exact public HTTPS hostname:

```yaml
environment:
  ALLOWED_ORIGIN: "https://game.example.com"
```

Then rebuild:

```bash
docker compose up -d --build
```

## Direct server install

```bash
PORT=8080 HOST=0.0.0.0 ALLOWED_ORIGIN=https://game.example.com npm start
```

Use systemd, Supervisor or another process manager to keep it running. Terminate TLS at Nginx or another reverse proxy so browsers use HTTPS and `wss://`.

## Operations

- Health endpoint: `GET /healthz`
- Maximum room size: two players
- Maximum WebSocket message: 128 KiB
- Per-connection rate limit: 90 messages per second
- Idle/broken connection detection: WebSocket ping every 30 seconds
- Static files are limited to `index.html`, `css/` and `js/`

The room code is a convenience secret, not authentication. Use the game with people you know during this MVP stage.

## Tests

```bash
npm test
```

The suite checks the room lifecycle and relay rules, static-file restrictions, health endpoint, audio lifecycle and JavaScript syntax.
