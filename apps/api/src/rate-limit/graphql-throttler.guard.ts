import type { Request, Response } from "express";
import { ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { GraphqlContext } from "@/graphql/graphql-context";

@Injectable()
export class GraphqlThrottlerGuard extends ThrottlerGuard {
  override getRequestResponse(context: ExecutionContext): {
    req: Request;
    res: Response;
  } {
    const graphqlContext =
      GqlExecutionContext.create(context).getContext<GraphqlContext>();

    return {
      req: graphqlContext.req,
      res: graphqlContext.res,
    };
  }
}
