// status: 429/503 the model is busy, 504 it took too long, 502 any other failure, 500 the server is misconfigured.
export class AiError extends Error {
  constructor(status, message = `AI request failed with status ${status}`) {
    super(message)
    this.status = status
  }
}
