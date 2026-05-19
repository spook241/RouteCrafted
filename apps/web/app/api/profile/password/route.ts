import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById, updateUserPassword } from "@/lib/db/users";
import bcrypt from "bcryptjs";

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters long" }, { status: 400 });
    }

    // Fetch user with hash
    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
    }

    // Hash and save new password
    const newHash = await bcrypt.hash(newPassword, 10);
    await updateUserPassword(user.id, newHash);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating password:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
