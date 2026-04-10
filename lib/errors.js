export class AppError extends Error {
  constructor(message, status = 500, meta = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.meta = meta;
  }
}
