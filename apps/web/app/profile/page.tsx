import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserByEmail } from "@/lib/db/users";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { AvatarUpload } from "@/components/auth/AvatarUpload";
import { PasswordChangeForm } from "@/components/auth/PasswordChangeForm";

export const metadata = { title: "Profile — RouteCrafted" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: profile identity */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-card text-center">
              <div className="flex justify-center mb-5">
                <AvatarUpload
                  currentUrl={user.avatarUrl ?? null}
                  initials={user.name?.charAt(0).toUpperCase() ?? "?"}
                />
              </div>
              <h2 className="font-headline font-bold text-on-surface text-xl">{user.name}</h2>
              <p className="text-sm font-label text-on-surface-variant mt-1">{user.email}</p>
              <div className="mt-4">
                <span className={`text-xs font-label font-semibold px-3 py-1 rounded-full ${
                  user.role === "admin"
                    ? "bg-primary-container/30 text-on-primary"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}>
                  {user.role}
                </span>
              </div>
            </div>
          </aside>

          {/* Right: edit form + stats */}
          <div className="lg:col-span-8 space-y-6">
            <div>
              <p className="text-xs font-label font-bold text-primary uppercase tracking-wider mb-2">Account</p>
              <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">
                Your Profile
              </h1>
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-card">
              <h3 className="font-headline font-bold text-on-surface text-lg mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">edit</span>
                Edit Details
              </h3>
              <ProfileForm initialName={user.name ?? ""} />
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-card">
              <h3 className="font-headline font-bold text-on-surface text-lg mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                Security
              </h3>
              <PasswordChangeForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
