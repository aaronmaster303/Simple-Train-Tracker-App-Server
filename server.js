import express from 'express';
import axios from 'axios';
import cors from 'cors';
import NodeCache from 'node-cache';

// const MBTA_API_KEY = process.env.MBTA_API_KEY;
const MBTA_API_KEY = '2a9bf598d2584bda8a3aec32f176044e';
const MBTA_API_BASE_URL = 'https://api-v3.mbta.com';

const DEBUG_MODE = false;

const app = express();

app.use(cors());
const port = process.env.PORT || 3000;

const generalCache = new NodeCache({ stdTTL: 86400 }); // General cache for 24 hours
const vehicleCache = new NodeCache({ stdTTL: 2.5 }); // Vehicle cache for 2.5 seconds
const alertsCache = new NodeCache({ stdTTL: 86400 / 4 }); // Alerts cache for 6 hours

let requestCount = 0;

const cacheMiddleware = (cacheInstance) => {
	return (req, res, next) => {
		const key = req.originalUrl;
		const cachedResponse = cacheInstance.get(key);

		if (cachedResponse) {
			if (DEBUG_MODE) console.log(`Serving cached response for ${key}`);
			res.json(cachedResponse);
		} else {
			requestCount++;
			if (DEBUG_MODE)
				console.log(
					`Making request #${requestCount} to MBTA API for ${key}`,
				);
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
		console.error('API call error:', error.response.statusText);
	} else {
		res.status(500).json({ error: error.message });
	}
};

app.get('/', cacheMiddleware(generalCache), async (_req, res) => {
	res.send('Hello');
});

app.get('/routes', cacheMiddleware(generalCache), async (req, res) => {
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
app.get('/stops', cacheMiddleware(generalCache), async (req, res) => {
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

app.get('/stops/bus', cacheMiddleware(generalCache), async (req, res) => {
	try {
		const vehiclesResponse = await axios.get(
			`${MBTA_API_BASE_URL}/vehicles`,
			{
				params: {
					api_key: MBTA_API_KEY,
					'filter[route]': req.query['route'],
					'filter[direction_id]': req.query['direction_id'],
				},
			},
		);

		const tripId =
			vehiclesResponse['data']['data'][0]['relationships']['trip'][
				'data'
			]['id'];

		const tripsResponse = await axios.get(
			`${MBTA_API_BASE_URL}/trips/${tripId}`,
			{
				params: {
					api_key: MBTA_API_KEY,
					include: 'stops',
				},
			},
		);

		const stopsIdObjectList =
			tripsResponse['data']['data']['relationships']['stops']['data'];
		const stopsIdList = stopsIdObjectList.map((stop) => stop.id).join(',');

		const stopsListResponse = await axios.get(
			`${MBTA_API_BASE_URL}/stops`,
			{
				params: {
					api_key: MBTA_API_KEY,
					'fields[stop]': 'name',
					'filter[id]': stopsIdList,
				},
			},
		);

		const stopsObjectList = stopsListResponse['data']['data'];
		const stopsNameList = stopsObjectList.map((stop) => ({
			id: stop.id,
			name: stop.attributes.name,
		}));

		if (req.query['direction_id'] === '0') {
			stopsNameList.reverse();
		}

		res.json(stopsNameList);
	} catch (error) {
		handleError(error, res);
	}
});

app.get('/stops/:stopId', cacheMiddleware(generalCache), async (req, res) => {
	const { stopId } = req.params;
	try {
		const response = await axios.get(
			`${MBTA_API_BASE_URL}/stops/${stopId}`,
			{
				params: {
					api_key: MBTA_API_KEY,
				},
			},
		);
		res.json(response.data);
	} catch (error) {
		handleError(error, res);
	}
});

// Vehicles endpoint
app.get('/vehicles', cacheMiddleware(vehicleCache), async (req, res) => {
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

app.get('/alerts', cacheMiddleware(alertsCache), async (req, res) => {
	try {
		const response = await axios.get(`${MBTA_API_BASE_URL}/alerts`, {
			params: {
				api_key: MBTA_API_KEY,
				'filter[route]': req.query['route'],
				'fields[alert]': 'header,effect,lifecycle,timeframe',
				'filter[activity]': 'BOARD,EXIT,RIDE',
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
