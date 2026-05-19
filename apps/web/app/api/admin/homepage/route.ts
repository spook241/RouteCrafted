import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSetting, upsertSetting } from '@/lib/db/ai-config';
import { fetchCityPhoto } from '@/lib/places/city-photo';

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (session.user.role !== 'admin') return new NextResponse('Forbidden', { status: 403 });

  try {
    const [
      captionSetting,
      destinationsSetting,
      headlineSetting,
      subheadlineSetting,
      curatorTipSetting,
      ctaSetting,
      badgesSetting
    ] = await Promise.all([
      getSetting('trending_caption'),
      getSetting('trending_destinations'),
      getSetting('hero_headline'),
      getSetting('hero_subheadline'),
      getSetting('curator_tip_text'),
      getSetting('cta_text'),
      getSetting('feature_badges')
    ]);
    
    return NextResponse.json({
      caption: captionSetting?.value || null,
      destinations: destinationsSetting?.value || null,
      hero_headline: headlineSetting?.value || null,
      hero_subheadline: subheadlineSetting?.value || null,
      curator_tip_text: curatorTipSetting?.value || null,
      cta_text: ctaSetting?.value || null,
      feature_badges: badgesSetting?.value || null
    });
  } catch (error) {
    console.error('Error fetching homepage content:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (session.user.role !== 'admin') return new NextResponse('Forbidden', { status: 403 });

  try {
    const body = await req.json();
    const { 
      caption, 
      destinations, 
      hero_headline, 
      hero_subheadline, 
      curator_tip_text, 
      cta_text, 
      feature_badges 
    } = body;
    
    const uid = session.user.id;

    // Save simple strings
    if (caption) await upsertSetting('trending_caption', caption, uid);
    if (hero_headline) await upsertSetting('hero_headline', hero_headline, uid);
    if (hero_subheadline) await upsertSetting('hero_subheadline', hero_subheadline, uid);
    if (curator_tip_text) await upsertSetting('curator_tip_text', curator_tip_text, uid);
    if (cta_text) await upsertSetting('cta_text', cta_text, uid);

    // Save badges array
    if (feature_badges && Array.isArray(feature_badges)) {
      await upsertSetting('feature_badges', JSON.stringify(feature_badges), uid);
    }

    // Process destinations array (Auto-generate images if missing)
    if (destinations && Array.isArray(destinations)) {
      for (const dest of destinations) {
        if (!dest.imageUrl || dest.imageUrl.trim() === '') {
          // Attempt to fetch city photo
          const photoResult = await fetchCityPhoto(dest.destination, dest.country);
          if (photoResult?.imageUrl) {
            dest.imageUrl = photoResult.imageUrl;
          } else {
            // Fallback to a default image if generation completely fails
            dest.imageUrl = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop";
          }
        }
      }
      await upsertSetting('trending_destinations', JSON.stringify(destinations), uid);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating homepage content:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
