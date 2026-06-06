export type CurrentUser = {
  id: "local-user";
  label: "Local User";
};

export type SessionPayload = {
  sub: string;
  label: string;
};

export const CURRENT_USER: CurrentUser = {
  id: "local-user",
  label: "Local User",
};
