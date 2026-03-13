# Simple Train Tracker — Backend Server

Express/Node.js server that proxies MBTA V3 API requests for two MBTA transit tracker clients — an iOS app and a vanilla JS web app.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/routes` | List routes. Pass `filter[type]=0,1` for subway, `filter[type]=3` for bus. |
| GET | `/stops` | List stops for a route. Pass `filter[route]=X&filter[direction_id]=Y`. |
| GET | `/stops/bus` | List stops for an active bus route. Pass `route=X&direction_id=Y`. Resolves stop names from the current trip. |
| GET | `/stops/:stopId` | Details for a single stop (name, etc.). |
| GET | `/vehicles` | Current vehicle positions. Pass `filter[route]=X&filter[direction_id]=Y`. |
| GET | `/alerts` | Active service alerts for a route. Pass `route=X`. |

---

## Tech Stack

- **Runtime:** Node.js (ESM)
- **Framework:** Express 4
- **HTTP client:** Axios
- **Caching:** node-cache (routes/stops cached 24 hrs, alerts 6 hrs, vehicles 2.5 s)
- **Logging:** Pino
- **Deployment:** Railway

---

## Getting Started

### Prerequisites

- Node.js 18+
- An [MBTA V3 API key](https://api-v3.mbta.com/) (free)

### Install and run

```bash
git clone https://github.com/master-aaron/Simple-Train-Tracker-App-Server.git
cd Simple-Train-Tracker-App-Server
npm install
```

Create a `.env` file (or set environment variables directly):

```
MBTA_API_KEY=your_api_key_here
PORT=3000
```

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

The server listens on `http://localhost:3000` by default.

---

## How It Works

The server sits between the mobile client and the MBTA V3 API (`https://api-v3.mbta.com`). Each incoming request is checked against an in-memory cache. On a cache miss the server forwards the request to MBTA with the API key attached, caches the response, and returns it to the client. This keeps the API key off the client device and reduces redundant calls to MBTA — particularly useful for static data like routes and stop lists.

The `/stops/bus` endpoint is the one exception to simple proxying: it makes three sequential MBTA calls (vehicles → trip → stops) to resolve an ordered stop list for an active bus trip, since the MBTA API does not return bus stops in trip order directly.

Deployed on Railway: `https://simple-train-tracker-app-server-production.up.railway.app`

---

## Client Apps

**iOS App** — [Simple-Train-Tracker-App](https://github.com/aaronmaster303/Simple-Train-Tracker-App)
[MBTA Train & Bus Tracker on the App Store](https://apps.apple.com/us/app/mbta-train-bus-tracker/id6748243506) · 100+ downloads · 5.0 stars

**Web App** — [Personal-Train-Tracker](https://github.com/aaronmaster303/Personal-Train-Tracker)
Vanilla HTML/CSS/JS client · 350+ active users

---

## Privacy Policy

https://aaronmaster303.github.io/MBTA-Train-Bus-Tracker-Privacy-Policy/

---

## License

MIT
