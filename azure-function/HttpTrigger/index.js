const createHandler = require("azure-function-express").createHandler;
const app = require("../app"); // adjust if your Express app is in another file

module.exports = createHandler(app);
