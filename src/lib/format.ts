/**
 * Shared formatting utilities for the application.
 */

/**
 * Format a currency value with the specified currency code.
 */
export function formatCurrency(value: number | null, currency: string = "USD"): string | null {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/**
 * Format a date string (YYYY-MM-DD) to a localized date string.
 */
export function formatDate(date: string | null): string | null {
  if (!date) return null;
  try {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

/**
 * Format a timestamp to a localized date and time string.
 */
export function formatDateTime(timestamp: string | null): string | null {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return timestamp;
  }
}
