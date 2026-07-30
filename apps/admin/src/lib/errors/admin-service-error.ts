export class AdminServiceError extends Error {
  readonly code: string;
  readonly status: 400 | 404 | 409;

  constructor(
    code: string,
    message: string,
    status: 400 | 404 | 409,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "AdminServiceError";
    this.code = code;
    this.status = status;
  }
}
