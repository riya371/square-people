const AppError = require('../utils/AppError');

// Usage: router.post('/', validate({ body: someZodSchema, query: ..., params: ... }), handler)
function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      if (err && err.issues) {
        const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
        return next(AppError.validation(details));
      }
      next(err);
    }
  };
}

module.exports = validate;
