// Escapes HTML special characters to prevent HTML injection in emails
export const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// Escapes a string for safe use inside a MongoDB $regex
export const escapeRegex = (str) =>
  String(str ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Basic email format validation (RFC 5322 simplified)
export const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? ""));
