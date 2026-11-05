export type Role = "owner" | "admin" | "editor" | "reader" | null;

export function canEditContent(role: Role) {
  return role === "owner" || role === "admin" || role === "editor";
}

export function canManageFandom(role: Role) {
  return role === "owner" || role === "admin";
}

export function canReadFandom(
  visibility: "public" | "unlisted" | "private",
  role: Role,
) {
  return visibility !== "private" || role !== null;
}
