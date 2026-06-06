import { Mutation, Query, Resolver } from "@nestjs/graphql";

@Resolver()
export class HealthResolver {
  @Query("health")
  health(): string {
    return "ok";
  }

  @Mutation("noop")
  noop(): boolean {
    return true;
  }
}
