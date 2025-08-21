import { NotFoundError, ValidationError, DatabaseError, ExternalError } from "../utils/Errors.js";

const errorHandler = (err, req, res, next) => {
  if (err instanceof NotFoundError) {
    return res.status(err.statusCode).json({
      message: err.message,
      code: err.name,
    });
  }

  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      message: err.message,
      code: err.name,
    });
  }

  if (err instanceof DatabaseError) {
    return res.status(err.statusCode).json({
      message: err.message,
      code: err.name,
    });
  }

  if (err instanceof ExternalError) {
    return res.status(err.statusCode).json({
      message: err.message,
      code: err.name,
    });
  }

  res.status(500).json({
    message:
      "Ocorreu um erro inesperado no servidor. Por favor, tente novamente mais tarde.",
    code: "InternalServerError",
  });
};

export default errorHandler;
