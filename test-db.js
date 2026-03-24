const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

dns.setDefaultResultOrder("ipv4first");
dns.setServers(['8.8.8.8', '8.8.4.4']);

const uri = process.env.MONGODB_URI;

async function test() {
    try {
        await mongoose.connect(uri);
        console.log("SUCCESS");
        process.exit(0);
    } catch (e) {
        console.error("FAILED_WITH_ERROR:", e.message);
        process.exit(1);
    }
}
test();
