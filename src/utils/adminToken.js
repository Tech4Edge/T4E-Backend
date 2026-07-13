import jwt from "jsonwebtoken";

const getSecret = () => {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is not configured");
  return secret;
};

export const createAdminToken = () => {
  const ttlHours = Number(process.env.ADMIN_TOKEN_TTL_HOURS || 12);
  return jwt.sign({ role: "admin" }, getSecret(), { expiresIn: `${ttlHours}h` });
};

export const verifyAdminTokenDetailed = (token) => {
  try {
    const payload = jwt.verify(token, getSecret());
    if (payload.role !== "admin") return { valid: false, reason: "invalid_role" };
    return { valid: true, reason: null, payload };
  } catch (err) {
    if (err.name === "TokenExpiredError") return { valid: false, reason: "expired" };
    return { valid: false, reason: "invalid_token" };
  }
};

export const verifyAdminToken = (token) => verifyAdminTokenDetailed(token).valid;
