export class IntegrationError extends Error {
  constructor(
    public status: number,
    public code: string,
    detail: string,
    public errors?: { index?: number; field: string; reason: string }[],
    public retryAfter?: number,
  ) {
    super(detail);
    this.name = "IntegrationError";
  }
}
