import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getSetting } from "@/lib/db/ai-config";
import { HomepageContentForm } from "@/components/admin/HomepageContentForm";
import Link from "next/link";

export const metadata = { title: "Content Management — RouteCrafted" };

export default async function HomepageAdminPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") notFound();

  const [
    captionSetting,
    destSetting,
    headlineSetting,
    subheadlineSetting,
    curatorTipSetting,
    ctaSetting,
    badgesSetting
  ] = await Promise.all([
    getSetting("trending_caption"),
    getSetting("trending_destinations"),
    getSetting('hero_headline'),
    getSetting('hero_subheadline'),
    getSetting('curator_tip_text'),
    getSetting('cta_text'),
    getSetting('feature_badges')
  ]);
  
  const initialData = {
    caption: captionSetting?.value || "Trending right now",
    hero_headline: headlineSetting?.value || "Where to next?",
    hero_subheadline: subheadlineSetting?.value || "AI-powered day-by-day travel plans with weather-aware replanning and Worth It / Skip It place cards.",
    curator_tip_text: curatorTipSetting?.value || "The best itineraries balance structured highlights with free exploration time. Let AI plan the must-sees — then leave afternoons open for wandering.",
    cta_text: ctaSetting?.value || "Craft my itinerary",
    feature_badges: badgesSetting?.value ? JSON.parse(badgesSetting.value) : ['AI Itineraries', 'Weather Replanning', 'Worth It / Skip It'],
    destinations: destSetting?.value ? JSON.parse(destSetting.value) : []
  };

  // Fallback default list if empty
  if (!initialData.destinations || initialData.destinations.length === 0) {
    initialData.destinations = [
      {
        id: "default-1",
        destination: "Tokyo",
        country: "Japan",
        imageUrl: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1994&auto=format&fit=crop",
        tagline: "Japan · Best in Spring",
        span: "wide"
      },
      {
        id: "default-2",
        destination: "Paris",
        country: "France",
        imageUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2073&auto=format&fit=crop",
        tagline: "France · Year-round",
        span: "narrow"
      },
      {
        id: "default-3",
        destination: "New York",
        country: "USA",
        imageUrl: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=2070&auto=format&fit=crop",
        tagline: "USA · All seasons",
        span: "narrow"
      },
      {
        id: "default-4",
        destination: "Amalfi Coast",
        country: "Italy",
        imageUrl: "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?q=80&w=1976&auto=format&fit=crop",
        tagline: "Italy · Summer escape",
        span: "wide"
      }
    ];
  }

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-label font-medium text-on-surface-variant hover:text-on-surface transition mb-8"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Admin Panel
        </Link>
        <div className="mb-8">
          <p className="text-xs font-label font-bold text-primary uppercase tracking-wider mb-2">CMS</p>
          <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight mb-1">Content Management</h1>
          <p className="text-on-surface-variant">Update the headline, texts, and destination cards on the homepage.</p>
        </div>
        <HomepageContentForm initialData={initialData} />
      </div>
    </div>
  );
}
