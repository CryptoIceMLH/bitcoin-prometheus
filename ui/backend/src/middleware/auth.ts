import { Request, Response, NextFunction } from "express";

export function authMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  // No authentication required — this is a local sovereign node
  next();
}
