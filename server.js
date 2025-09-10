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
const predictionsCache = new NodeCache({ stdTTL: 0.5 }); // Predictions cache for 3 seconds
const alertsCache = new NodeCache({ stdTTL: 60 }); // Alerts cache for every 1 minute

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
				'fields[alert]': 'header,effect,lifecycle,timeframe,severity',
				'filter[activity]': 'BOARD,EXIT,RIDE',
				sort: 'severity',
			},
		});

		res.json(response.data);
	} catch (error) {
		handleError(error, res);
	}
});

app.get('/predictions', cacheMiddleware(predictionsCache), async (req, res) => {
	try {
		const response = await axios.get(`${MBTA_API_BASE_URL}/predictions`, {
			params: {
				api_key: MBTA_API_KEY,
				'filter[route]': req.query['route'],
				'filter[direction_id]': req.query['direction_id'],
				'fields[prediction]': 'departure_time,arrival_time',
				'filter[stop]': req.query['stop'],
				sort: 'arrival_time',
			},
		});

		// Print arrival times in list
		// const arrivalTimes = [];
		//
		// response.data.data.forEach((prediction) => {
		// 	const dateTime = new Date(prediction.attributes.arrival_time);
		// 	arrivalTimes.push(dateTime.toLocaleString());
		// });
		//
		// console.log(arrivalTimes);

		const arrivalTime = new Date(
			response.data.data[0].attributes.arrival_time,
		);

		const currentTime = new Date();
		const timeUntilArrival = Math.round((arrivalTime - currentTime) / 1000); // Convert milliseconds to seconds

		let minutes = Math.floor(timeUntilArrival / 60);
		let seconds = timeUntilArrival % 60;

		if (timeUntilArrival < 0) {
			minutes = 0;
			seconds = 0;
		}

		res.json({ minutes, seconds });
	} catch (error) {
		handleError(error, res);
	}
});

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
