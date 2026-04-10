import { AppError } from "./errors.js";

export async function fetchJson(url, options = {}) {
  const { timeoutMs = 9000, retries = 0, ...rest } = options;
  let attempt = 0;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...rest,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(rest.headers || {})
        },
        cache: "no-store"
      });

      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text();
        throw new AppError(`Provider error ${response.status}: ${text.slice(0, 180)}`, 502);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timer);
      if (attempt === retries) {
        if (error.name === "AbortError") {
          throw new AppError("Upstream request timeout", 504);
        }
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(error.message || "Upstream request failed", 502);
      }
      attempt += 1;
    }
  }

  throw new AppError("Unexpected fetch error", 500);
}
