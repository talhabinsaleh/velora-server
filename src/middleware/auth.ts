import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Role, User } from "../models/User";
import { HttpError, isObjectId } from "../utils/http";

export const TOKEN_COOKIE = "salonbook_token";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

function readToken(req: Request) {
  const cookie = req.cookies?.[TOKEN_COOKIE];
  if (cookie) return String(cookie);
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

// Checks the JWT the client issued after Better Auth confirmed the login. The role and blocked
// flag are then read fresh from the database, so a block or role change applies immediately.
export async function verifyJWT(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) throw new HttpError(401, "Unauthorized: please sign in first.");

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret(), {
      algorithms: ["HS256"],
      issuer: "salonbook",
    }) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, "Unauthorized: your session has expired. Please sign in again.");
  }

  if (!isObjectId(payload.sub)) throw new HttpError(401, "Unauthorized: invalid token.");
  const user = await User.findById(payload.sub).lean();
  if (!user) throw new HttpError(401, "Unauthorized: this account no longer exists.");
  if (user.isBlocked) {
    throw new HttpError(403, "Your account has been blocked. Please contact the salon for help.");
  }

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role === "admin" ? "admin" : "customer",
  };
  next();
}

// Use after verifyJWT. Rejects users whose role is not in the list.
export function verifyRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, "Unauthorized: please sign in first.");
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, "Forbidden: you do not have permission to do this.");
    }
    next();
  };
}

export const verifyAdmin = verifyRole("admin");
export const verifyCustomer = verifyRole("customer");
