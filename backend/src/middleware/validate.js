const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/** Runs an array of express-validator chains and returns 422 with field errors on failure. */
const validate = (chains) => async (req, _res, next) => {
  for (const chain of chains) {
    // eslint-disable-next-line no-await-in-loop
    await chain.run(req);
  }
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  const err = new ApiError(422, errors[0].message, errors);
  return next(err);
};

/** Validates :id style params as Mongo ObjectIds. */
const validateObjectId = (...params) => (req, _res, next) => {
  for (const p of params.length ? params : ['id']) {
    if (req.params[p] && !mongoose.isValidObjectId(req.params[p])) {
      return next(ApiError.badRequest(`Invalid ${p}`));
    }
  }
  return next();
};

module.exports = { validate, validateObjectId };
