const { createClient } = require('redis');

const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

const connectRedis = async () => {
    try {
        await redisClient.connect().catch(err => {
            console.error('Redis initial connection failed:', err.message);
        });
        console.log('Redis connected successfully');
    } catch (err) {
        console.error('Redis connection failed. Continuing without Redis cache...');
        // We don't exit process here so app can still run with just MongoDB
    }
};

module.exports = { redisClient, connectRedis };
