// backend/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const videoRoutes = require('./routes/videos');
const usersRoute = require('./routes/users');
const commentsRouter = require('./routes/comments');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/videos', videoRoutes);
app.use('/api/users', usersRoute);
app.use('/api/comments', commentsRouter);

// Health check (root)
app.get('/', (req, res) => res.send('Backend server is running.'));

// Only start the HTTP server when this file is executed directly.
// When imported by the Azure Function wrapper, it will NOT call listen().
if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

// Export the app so Azure Function (serverless-http) can use it
module.exports = app;
