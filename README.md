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

This version supports exactly two players per room. Rooms are held in memory and disappear when either player disconnects or after six hours. Optional Google Sign-In provides only a minimal player identity; it is not connected to co-op and there are no public room lists, matchmaking, game history or persistent scores.

## Run locally

Node.js 22.13 or newer is required. Install dependencies and start the server:

```bash
npm ci
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

## Optional Google Sign-In

Authentication is optional. If `GOOGLE_CLIENT_ID` is absent, the sign-in control stays hidden and all guest gameplay continues to work.

Current Google Cloud setup:

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. Open **Google Auth Platform → Branding** and register the app. Set the application name, support email, authorized production domain, homepage and privacy-policy details as applicable.
3. Open **Audience**. Choose **External** for general Google accounts or **Internal** for a Google Workspace-only deployment. While the app is in testing, add the Google accounts that may sign in as test users.
4. Open **Data Access** and keep only the default authentication scopes (`openid`, email and profile). Starfall does not need sensitive Google API scopes.
5. Open **Clients → Create client**, choose **Web application**, and add exact **Authorized JavaScript origins**. Use `http://localhost:8080` for local development and the exact HTTPS origin such as `https://game.example.com` for production. Do not add a callback path or redirect URI; this integration uses the JavaScript credential callback.
6. Copy the resulting public client ID (ending in `.apps.googleusercontent.com`) into `GOOGLE_CLIENT_ID`. No Google client secret is used or required.
7. For public production use, finish the Branding/Audience publishing or verification steps Google shows for the chosen audience and domains.

Local example:

```bash
GOOGLE_CLIENT_ID=1234567890-example.apps.googleusercontent.com npm start
```

For Compose, put the value in an uncommitted `.env` file and rebuild:

```dotenv
GOOGLE_CLIENT_ID=1234567890-example.apps.googleusercontent.com
```

```bash
docker compose up -d --build
```

The Compose service persists SQLite at `/app/data/starfall.sqlite` in the `starfall-data` volume. A direct install defaults to `data/starfall.sqlite`; override it with `AUTH_DB_PATH` when needed. Continue setting `ALLOWED_ORIGIN` to the exact public origin when deployed behind a reverse proxy.

The server verifies each Google ID token's signature, issuer, expiry and audience with Google's official Node.js library before trusting its `sub`, name, email or avatar claims. It then creates an opaque 30-day session in an HttpOnly, SameSite=Lax cookie (`Secure` on HTTPS). Raw session tokens, Google ID tokens and Google access tokens are never stored in SQLite.

Auth API:

- `POST /api/auth/google` — verifies a Google ID token and creates/updates the local user and session.
- `GET /api/me` — returns the current minimal profile, or HTTP 401 for a guest.
- `POST /api/logout` — revokes the current local session and clears the cookie.

SQLite creates `users` (`id`, unique `google_sub`, `display_name`, `email`, `avatar_url`, `created_at`, `last_login_at`) and `sessions` (hashed session ID, user reference, creation and expiry timestamps). Authentication remains separate from WebSocket room state.

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

## Automatic production deployment

The `Deploy production` GitHub Actions workflow runs after every push or merged pull request to `main`. It tests the exact commit, connects to the existing server checkout, fast-forwards it, rebuilds the Compose service and verifies that `/healthz` reports the deployed commit SHA. Concurrent deployments run sequentially.

The HTML response also adds the deployed commit SHA to CSS and JavaScript URLs. This makes browsers and CDNs request the new assets immediately after a release instead of continuing to use the previous cached game code. In ArvanCloud, keep query strings included in the cache key.

Create a dedicated SSH key for deployment, add its public key to the server account's `authorized_keys`, and make sure that account can run `docker compose` without an interactive password. The existing checkout must stay clean; deployment stops instead of overwriting server-side edits.

Create a GitHub environment named `production`, then add these environment secrets under **Settings → Environments → production**:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | Server hostname or public IP |
| `DEPLOY_USER` | SSH account that owns the checkout |
| `DEPLOY_PORT` | SSH port; omit or set `22` |
| `DEPLOY_PATH` | Absolute existing checkout path, such as `/opt/mahGames` |
| `DEPLOY_SSH_KEY` | Private Ed25519 deployment key |
| `DEPLOY_KNOWN_HOSTS` | Verified `known_hosts` entry for the server |

You can reuse the checkout already running on the server: set `DEPLOY_PATH` to that exact directory and make sure `DEPLOY_USER` owns it. Do not edit files inside that checkout manually because the workflow intentionally refuses to overwrite local changes.

If you prefer a dedicated checkout, create it only once (replace `deploy` with your actual deployment account):

```bash
sudo install -d -o deploy -g deploy /opt/mahGames
sudo -u deploy git clone https://github.com/scargosnail598/mahGames.git /opt/mahGames
```

Generate the key on your admin machine, authorize it on the server, and capture the server host key. Put the private key and the full `known_hosts` output only in GitHub secrets—never commit them:

```bash
ssh-keygen -t ed25519 -f starfall-deploy -C github-actions-starfall
ssh-copy-id -i starfall-deploy.pub deploy@YOUR_SERVER_IP
ssh-keyscan -H YOUR_SERVER_IP > starfall-known-hosts
```

Set `DEPLOY_SSH_KEY` to the contents of `starfall-deploy` and `DEPLOY_KNOWN_HOSTS` to the contents of `starfall-known-hosts`. The deployment account must be able to run `docker compose` without an interactive password.

After the secrets are configured, merge to `main` or run **Actions → Deploy production → Run workflow**. Check the active release with:

```bash
curl https://game.example.com/healthz
```

The response includes `version`, containing the full deployed commit SHA.

## Tests

```bash
npm test
```

The suite checks the room lifecycle and relay rules, static-file restrictions, health endpoint, audio lifecycle and JavaScript syntax.
