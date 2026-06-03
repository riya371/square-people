const bcrypt = require('bcryptjs');
const env = require('../config/env');

const PIN_REGEX = /^\d{4}$/;

function isValidPin(pin) {
  return typeof pin === 'string' && PIN_REGEX.test(pin);
}

async function hashPin(pin) {
  if (!isValidPin(pin)) throw new Error('PIN must be exactly 4 digits.');
  return bcrypt.hash(pin, env.BCRYPT_SALT_ROUNDS);
}

async function verifyPin(pin, hash) {
  if (!isValidPin(pin) || !hash) return false;
  return bcrypt.compare(pin, hash);
}

module.exports = { isValidPin, hashPin, verifyPin };
