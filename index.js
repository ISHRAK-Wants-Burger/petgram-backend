
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const videoRoutes = require('./routes/videos');
const usersRoute = require('./routes/users');

const app = express();
app.use(cors());
app.use(express.json());



// Mount our video API under /api/videos
app.use('/api/videos', videoRoutes);

//for user management, mount under /api/users
app.use('/api/users', usersRoute);










// Health check
app.get('/', (req, res) => res.send('Backend server is running.'));

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
