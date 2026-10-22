import { saveEscapade } from '../../../../lib/escapade/share-service';

/**
 * Route POST /api/escapades/share
 * Reçoit un EscapadePlan complet, le persiste et retourne une URL courte partageable.
 */
export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== 'object' ||
      !body.profile ||
      !body.profile.baseSector ||
      !body.days ||
      !Array.isArray(body.days) ||
      body.days.length === 0
    ) {
      return Response.json(
        {
          error:
            'Invalid escapade plan: payload must include valid profile and non-empty days array.',
        },
        { status: 400 }
      );
    }

    const { slug, url } = await saveEscapade(body);

    return Response.json({
      success: true,
      slug,
      url,
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || 'Failed to save escapade' },
      { status: 500 }
    );
  }
}
