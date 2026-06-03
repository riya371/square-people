class AppError extends Error {
  constructor(httpStatus, code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details = null) {
    return new AppError(400, 'INVALID_INPUT', message, details);
  }

  static validation(details) {
    return new AppError(400, 'VALIDATION_FAILED', 'Validation failed.', details);
  }

  static unauthenticated(message = 'Authentication required.') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'You do not have permission to do that.') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(entity = 'Resource') {
    return new AppError(404, 'NOT_FOUND', `${entity} not found.`);
  }

  static conflict(code, message, details = null) {
    return new AppError(409, code, message, details);
  }

  static businessRule(code, message, details = null) {
    return new AppError(422, code, message, details);
  }
}

module.exports = AppError;
