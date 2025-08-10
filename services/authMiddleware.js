// const admin = require('firebase-admin');

// admin.initializeApp({
//   credential: admin.credential.cert({
//     projectId: process.env.FIREBASE_PROJECT_ID,
//     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//     privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
//   }),
// });

// module.exports = async function (req, res, next) {
//   const authHeader = req.headers.authorization || '';
//   // console.log("Headers:", req.headers);


//    if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     console.log(authHeader);
    
//     return res.status(401).json({ error: "Missing auth token 1" });
//   };

//   const token = authHeader.split(' ')[1];
//   if (!token) return res.status(401).json({ error: 'Missing auth token 2' });

//   try {
//     const decodedToken = await admin.auth().verifyIdToken(idToken);
//     req.user = decodedToken;
//     next();
//   } catch (err) {
//     console.error("Token verification failed:", err.message);
//     res.status(401).json({ error: "Invalid auth token" });
//   }
// };

// backend/services/authMiddleware.js
const admin = require('../firebaseAdmin');

module.exports = async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    console.error('Auth error:', err && err.message ? err.message : err);
    return res.status(401).json({ error: 'Invalid auth token' });
  }
};
