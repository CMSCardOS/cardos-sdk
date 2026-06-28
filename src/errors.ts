/** A typed error for any non-2xx CardOS API response (or a transport failure). */
export class CardOSError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 for network/timeout failures. */
    readonly status: number,
    /** Stable error code from the API, when present (e.g. "unauthorized", "card_closed"). */
    readonly code?: string,
    /** Raw response body, for debugging. */
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CardOSError';
  }
}
