/** Application error with safe client-facing message and code. */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public errors: unknown[] = []
  ) {
    super(message);
    this.name = 'AppError';
  }
}
