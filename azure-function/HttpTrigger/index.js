// azure-function/HttpTrigger/index.js
const createHandler = require('azure-function-express').createHandler;
const path = require('path');
const app = require(path.join(__dirname, '..', '..', 'index')); // require root index.js
module.exports = createHandler(app);
