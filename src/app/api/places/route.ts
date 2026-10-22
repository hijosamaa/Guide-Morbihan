import { NextResponse } from 'next/server';
import { getAllPlaces } from '@/lib/data/places';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('cat') || searchParams.get('category') || undefined;
    const rainOnly = searchParams.get('pluie') === 'true';
    const shelteredFromWind = searchParams.get('vent') === 'true';
    const tideFilter = searchParams.get('maree') || undefined;

    const places = await getAllPlaces({
      category,
      rainOnly,
      shelteredFromWind,
      tideFilter,
    });

    return NextResponse.json(
      {
        success: true,
        count: places.length,
        places,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('API /api/places error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch places' },
      { status: 500 }
    );
  }
}
