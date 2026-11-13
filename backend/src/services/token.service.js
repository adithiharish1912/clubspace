const jwt = require('jsonwebtoken');
const env = require('../config/env');

// "v" = token version; it changes whenever the password changes, which revokes older tokens.
const signAccessToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role, v: user.tokenVersion || 0 }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

module.exports = { signAccessToken };
