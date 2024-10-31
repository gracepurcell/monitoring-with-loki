// server.js
const express = require('express');
const winston = require('winston');
const client = require('prom-client');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Ensure log directory exists
const logDirectory = '/var/log/node-app';
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

// Set up Winston logger to write logs to file
const logger = winston.createLogger({
    level: 'info',  // Log level
    format: winston.format.json(),  // Log format
    defaultMeta: { service: 'node-express-service' },  // Default metadata
    transports: [
        new winston.transports.File({ filename: path.join(logDirectory, 'app.log') }),  // Log to file
    ],
});

// Prometheus metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();  // Collect default metrics

const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    labelNames: ['method', 'route', 'code'],
    buckets: [50, 100, 300, 500, 1000, 3000],
});

// Middleware to measure request duration and log requests
app.use((req, res, next) => {
    const end = httpRequestDurationMicroseconds.startTimer();
    res.on('finish', () => {
        end({ method: req.method, route: req.path, code: res.statusCode });
        logger.info(`${req.method} ${req.path} ${res.statusCode}`);
    });
    next();
});

// Define routes
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

// Start the server
app.listen(port, () => {
    logger.info(`Server is running on <http://localhost>:${port}`);
});
