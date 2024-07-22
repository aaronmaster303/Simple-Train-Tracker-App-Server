import express from "express";
import { get } from "axios";
import NodeCache from "node-cache";

const MBTA_API_KEY = process.env.MBTA_API_KEY;
const MBTA_BASE_URL = "https://api-v3.mbta.com";

const app = express();
const port = process.env.PORT || 3000;

// const generalCache = new NodeCache({ stdTTL: 86400 }); // General cache for 24 hours
const generalCache = new NodeCache({ stdTTL: 5 }); // General cache for 5 seconds
const vehicleCache = new NodeCache({ stdTTL: 2.5 }); // Vehicle cache for 2.5 seconds

const cacheMiddleware = (cacheInstance) => {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cachedResponse = cacheInstance.get(key);

    if (cachedResponse) {
      res.json(cachedResponse);
    } else {
      res.sendResponse = res.json;
      res.json = (body) => {
        cacheInstance.set(key, body);
        res.sendResponse(body);
      };
      next();
    }
  };
};

app.get("/routes", cacheMiddleware(generalCache), async (req, res) => {
  try {
    const response = await get(`${MBTA_BASE_URL}/routes`, {
      params: {
        api_key: MBTA_API_KEY,
        ...req.query,
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

// Stops endpoint
app.get("/stops", cacheMiddleware(generalCache), async (req, res) => {
  try {
    const response = await get(`${MBTA_BASE_URL}/stops`, {
      params: {
        api_key: MBTA_API_KEY,
        ...req.query,
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

app.get("/stops/:stopId", cacheMiddleware(stopCache), async (req, res) => {
  const { stopId } = req.params;
  try {
    const response = await axios.get(`${MBTA_BASE_URL}/stops/${stopId}`, {
      params: {
        api_key: MBTA_API_KEY,
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

// Vehicles endpoint
app.get("/vehicles", cacheMiddleware(vehicleCache), async (req, res) => {
  try {
    const response = await get(`${MBTA_BASE_URL}/vehicles`, {
      params: {
        api_key: MBTA_API_KEY,
        ...req.query,
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
