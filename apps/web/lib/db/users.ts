import { eq, asc, count as drizzleCount } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";

export async function getUserByEmail(email: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0] ?? null;
}

export async function getUserById(id: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function updateUser(
  id: string,
  data: Partial<{ name: string; avatarUrl: string; expoPushToken: string }>,
) {
  const rows = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function updateUserPassword(id: string, passwordHash: string) {
  const rows = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return rows[0] ?? null;
}


// ─── Admin helpers ────────────────────────────────────────────────────────────

export async function getAllUsers(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt))
    .limit(limit)
    .offset(offset);
  const [total] = await db.select({ value: drizzleCount() }).from(users);
  return { rows, total: Number(total.value) };
}

export async function updateUserRole(id: string, role: "traveler" | "admin") {
  const rows = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return rows[0] ?? null;
}

