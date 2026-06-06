import type { Request, Response } from "express";

export type GraphqlContext = {
  req: Request;
  res: Response;
};
