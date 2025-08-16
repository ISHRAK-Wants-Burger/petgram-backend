// azure-function/HttpTrigger/index.js
const createHandler = require('azure-function-express').createHandler;
const path = require('path');

// Resolve to the repo-root index.js at runtime
// __dirname -> C:\home\site\wwwroot\HttpTrigger
// path.join(__dirname, '..', 'index') -> C:\home\site\wwwroot\index.js
const appPath = path.join(__dirname, '..', 'index'); 
console.log('Loading Express app from:', appPath);

const app = require(appPath);

module.exports = createHandler(app);
