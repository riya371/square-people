const AppError = require('../utils/AppError');

function errorHandler(err, req, res, _next) {
  // Sequelize validation/unique errors → 400 with details
  if (err && (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError')) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed.',
        details: (err.errors || []).map((e) => ({ path: e.path, message: e.message })),
      },
    });
  }

  // Our AppError
  if (err instanceof AppError) {
    return res.status(err.httpStatus).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Anything else → 500
  if (req.log) req.log.error({ err }, 'Unhandled error');
  else console.error('Unhandled error:', err);
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong.', details: null },
  });
}

module.exports = errorHandler;
