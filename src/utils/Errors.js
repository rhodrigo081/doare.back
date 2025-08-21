export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 409;
  }
}

export class DatabaseError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = "DatabaseError";
    this.statusCode = 500;
    this.originalError = originalError;
  }
}

export class ExternalError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = "ExternalError";
    this.statusCode = 502;
    this.originalError = originalError;
  }
}

