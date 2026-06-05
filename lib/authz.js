export const ADMIN_EMAIL = "notnamenf4@gmail.com";

export function isAdminUser(user) {
  return String(user?.email || "").toLowerCase() === ADMIN_EMAIL;
}

export function forbidden() {
  return Response.json({ error: "Недостаточно прав. Действие доступно только администратору." }, { status: 403 });
}
