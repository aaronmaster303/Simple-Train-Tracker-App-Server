import express from "express";
import axios from "axios";
import NodeCache from "node-cache";

const MBTA_API_KEY = "2a9bf598d2584bda8a3aec32f176044e";
const MBTA_API_BASE_URL = "https://api-v3.mbta.com";
const MBTA_BASE_URL = "https://www.mbta.com";

const app = express();
const port = process.env.PORT || 3000;

const generalCache = new NodeCache({ stdTTL: 86400 }); // General cache for 24 hours
const vehicleCache = new NodeCache({ stdTTL: 2.5 }); // Vehicle cache for 2.5 seconds

let requestCount = 0;

const cacheMiddleware = (cacheInstance) => {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cachedResponse = cacheInstance.get(key);

    if (cachedResponse) {
      console.log(`Serving cached response for ${key}`);
      res.json(cachedResponse);
    } else {
      requestCount++;
      console.log(`Making request #${requestCount} to MBTA API for ${key}`);
      res.sendResponse = res.json;
      res.json = (body) => {
        cacheInstance.set(key, body);
        res.sendResponse(body);
      };
      next();
    }
  };
};

const handleError = (error, res) => {
  if (error.response) {
    res.status(error.response.status).json({ error: error.response.data });
    console.error("API call error:", error.response.statusText);
  } else {
    res.status(500).json({ error: error.message });
  }
};

app.get("/", cacheMiddleware(generalCache), async (req, res) => {
  res.send("Hello");
});

app.get("/routes", cacheMiddleware(generalCache), async (req, res) => {
  try {
    const response = await axios.get(`${MBTA_API_BASE_URL}/routes`, {
      params: {
        api_key: MBTA_API_KEY,
        ...req.query,
      },
    });
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
});

// Stops endpoint
app.get("/stops", cacheMiddleware(generalCache), async (req, res) => {
  try {
    const response = await axios.get(`${MBTA_API_BASE_URL}/stops`, {
      params: {
        api_key: MBTA_API_KEY,
        ...req.query,
      },
    });
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
});

app.get("/stops/bus", cacheMiddleware(generalCache), async (req, res) => {
  try {
    const route_pattern_list = await axios.get(
      `${MBTA_API_BASE_URL}/route_patterns`,
      {
        params: {
          api_key: MBTA_API_KEY,
          sort: "typicality",
          "filter[direction_id]": req.query["direction_id"],
          "filter[route]": req.query["route"],
          "fields[route_pattern]": "",
        },
      },
    );

    const route_pattern = route_pattern_list["data"]["data"][0]["id"];
    console.log(route_pattern);

    const stop_list_response = await axios.get(
      `${MBTA_BASE_URL}/schedules/line_api`,
      {
        params: {
          api_key: MBTA_API_KEY,
          id: req.query["route"],
          direction_id: req.query["direction_id"],
          route_pattern: route_pattern,
        },
      },
    );

    const stop_list = stop_list_response["data"]["route_stop_lists"][0];
    const stop_names_list = stop_list.map((stop) => ({ name: stop.name }));

    res.json(stop_names_list);
  } catch (error) {
    handleError(error, res);
  }
});

app.get("/stops/:stopId", cacheMiddleware(generalCache), async (req, res) => {
  const { stopId } = req.params;
  try {
    const response = await axios.get(`${MBTA_API_BASE_URL}/stops/${stopId}`, {
      params: {
        api_key: MBTA_API_KEY,
      },
    });
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
});

// Vehicles endpoint
app.get("/vehicles", cacheMiddleware(vehicleCache), async (req, res) => {
  try {
    const response = await axios.get(`${MBTA_API_BASE_URL}/vehicles`, {
      params: {
        api_key: MBTA_API_KEY,
        ...req.query,
      },
    });
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
