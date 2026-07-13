import { verifyAdminTokenDetailed } from "../utils/adminToken.js";

export const adminAuth = (req, res, next) => {
  const token = req.cookies?.t4e_admin_token;
  if (!token) {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized admin request" });
  }

  const check = verifyAdminTokenDetailed(token);
  if (!check.valid) {
    if (check.reason === "expired") {
      return res.status(401).json({ code: "TOKEN_EXPIRED", message: "Session expired. Please login again." });
    }
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized admin request" });
  }

  req.admin = check.payload;
  next();
};
