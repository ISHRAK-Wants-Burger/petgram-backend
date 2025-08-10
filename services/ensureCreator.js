module.exports = function ensureCreator(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const role = user.role || (user.claims && user.claims.role);
  if (role === 'creator') return next();
  return res.status(403).json({ error: 'Creator access required' });
};
