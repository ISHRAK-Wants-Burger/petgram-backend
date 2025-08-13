// backend/azure-function/HttpTrigger/index.js
const serverless = require('serverless-http');
const app = require('../../index'); // path to your exported Express app

// Optionally set basePath if you want function URL to be /api/...;
// leaving default so routes match exactly. You can tune below.
const handler = serverless(app, { basePath: '' });

module.exports = async function (context, req) {
  // serverless-http expects (req, res) signature; it adapts for Azure
  return handler(context, req);
};
