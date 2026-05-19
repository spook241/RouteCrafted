import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TripForm } from "@/components/trips/TripForm";

export const metadata = { title: "Plan a trip — RouteCrafted" };

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export default async function NewTripPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialDestination = typeof sp.destination === 'string' ? sp.destination : '';
  const initialCountry = typeof sp.country === 'string' ? sp.country : '';

  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: form */}
          <div className="lg:col-span-7">
            <div className="mb-8">
              <p className="text-xs font-label font-bold text-primary uppercase tracking-wider mb-2">New Journey</p>
              <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight mb-2">
                Where to next?
              </h1>
              <p className="text-on-surface-variant">
                Tell us about your trip and we&apos;ll craft a day-by-day itinerary.
              </p>
            </div>
            <TripForm initialDestination={initialDestination} initialCountry={initialCountry} />
          </div>

          {/* Right: illustration + tips */}
          <aside className="lg:col-span-5 space-y-6">
            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-card">
              <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-primary text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>explore</span>
              </div>
              <h3 className="font-headline font-bold text-on-surface text-xl mb-3">AI-powered planning</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Your preferences shape a personalised day-by-day itinerary — morning, afternoon, and evening activities, curated to your style and pacing.
              </p>
            </div>
            <div className="bg-surface-container-low rounded-3xl p-6">
              <p className="text-xs font-label font-bold text-primary uppercase tracking-wider mb-3">Tips</p>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                {[
                  'Pick a specific city or region for the best itineraries.',
                  'Longer trips (5–10 days) unlock multi-district routing.',
                  'You can rewrite any day with the AI Rewrite button.',
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
