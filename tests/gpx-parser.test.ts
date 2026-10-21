import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGpxTrack } from '../src/lib/gpx-parser.js';

// GPX minimaliste pour test : 3 points avec coordonnées et altitudes
const VALID_GPX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Antigravity">
  <trk>
    <name>Sentier des Douaniers Arradon</name>
    <trkseg>
      <trkpt lat="47.6258" lon="-2.8277"><ele>5.0</ele></trkpt>
      <trkpt lat="47.6290" lon="-2.8310"><ele>12.0</ele></trkpt>
      <trkpt lat="47.6320" lon="-2.8350"><ele>7.0</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const FLAT_COASTAL_NOISY_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PhoneGPS">
  <trk>
    <name>Tour de Berder</name>
    <trkseg>
      <trkpt lat="47.5780" lon="-2.8870"><ele>3.0</ele></trkpt>
      <trkpt lat="47.5790" lon="-2.8880"><ele>4.2</ele></trkpt>
      <trkpt lat="47.5800" lon="-2.8890"><ele>2.8</ele></trkpt>
      <trkpt lat="47.5810" lon="-2.8900"><ele>3.5</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const GPX_2D_NO_ELEVATION = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Tracé plat 2D</name>
    <trkseg>
      <trkpt lat="47.5000" lon="-2.8000"></trkpt>
      <trkpt lat="47.5100" lon="-2.8100"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

test('parseGpxTrack accurately parses valid 3D GPX track', () => {
  const result = parseGpxTrack(VALID_GPX_XML);

  assert.ok(result.track, 'LineString Feature must be produced');
  assert.equal(result.track.geometry.type, 'LineString');
  assert.equal(result.track.geometry.coordinates.length, 3);
  assert.ok(result.distanceKm > 0.5 && result.distanceKm < 1.5, `Distance was ${result.distanceKm}km`);
  assert.equal(result.elevationGainM, 7); // 5m -> 12m = +7m
  assert.equal(result.elevationLossM, 5); // 12m -> 7m = -5m
  assert.equal(result.minElevationM, 5);
  assert.equal(result.maxElevationM, 12);
  assert.ok(result.estimatedDurationMinutes > 0);
  assert.equal(result.elevationProfile.length, 3);
});

test('parseGpxTrack eliminates micro-noise on flat coastal tracks', () => {
  const result = parseGpxTrack(FLAT_COASTAL_NOISY_GPX);
  assert.equal(result.elevationGainM, 0, 'Noisy variations <= 1.4m should yield 0m D+');
  assert.equal(result.elevationLossM, 0);
});

test('parseGpxTrack gracefully handles 2D GPX tracks with 0 elevation', () => {
  const result = parseGpxTrack(GPX_2D_NO_ELEVATION);
  assert.equal(result.elevationGainM, 0);
  assert.equal(result.elevationLossM, 0);
  assert.equal(result.minElevationM, 0);
  assert.equal(result.maxElevationM, 0);
  assert.ok(result.distanceKm > 1.0);
});

test('parseGpxTrack throws clear error on empty or invalid XML', () => {
  assert.throws(() => parseGpxTrack(''), /Empty or invalid GPX/);
  assert.throws(() => parseGpxTrack('<notgpx>hello</notgpx>'), /No track found/);
});

test('parseGpxTrack downsamples elevation profile according to maxProfilePoints', () => {
  // Generate a GPX with 300 points
  const points = [];
  for (let i = 0; i < 300; i++) {
    const lat = 47.6000 + i * 0.0001;
    const lon = -2.8000 + i * 0.0001;
    const ele = 10 + (i % 20);
    points.push(`<trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`);
  }
  const largeGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      ${points.join('\n')}
    </trkseg>
  </trk>
</gpx>`;

  const result = parseGpxTrack(largeGpx, { maxProfilePoints: 50 });
  assert.ok(result.elevationProfile.length <= 52, `Profile points length was ${result.elevationProfile.length}`);
  assert.equal(result.elevationProfile[0].distKm, 0);
  assert.equal(result.elevationProfile[result.elevationProfile.length - 1].distKm, result.distanceKm);
  // Default name check
  assert.equal(result.track.properties?.name, 'Trace GPX');
});

test('parseGpxTrack supports MultiLineString tracks with multiple segments', () => {
  const multiSegGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Sentier multi-segments</name>
    <trkseg>
      <trkpt lat="47.600" lon="-2.800"><ele>10</ele></trkpt>
      <trkpt lat="47.605" lon="-2.805"><ele>15</ele></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="47.610" lon="-2.810"><ele>20</ele></trkpt>
      <trkpt lat="47.615" lon="-2.815"><ele>25</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

  const result = parseGpxTrack(multiSegGpx);
  assert.equal(result.track.geometry.coordinates.length, 4);
  assert.equal(result.elevationGainM, 15); // 10 -> 25 = +15m
  assert.equal(result.track.properties?.name, 'Sentier multi-segments');
});

test('parseGpxTrack respects custom elevationHysteresisMeters option', () => {
  // With 3.0m default hysteresis, 2m change is ignored. With 1.0m, it's counted.
  const customHysteresisGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="47.600" lon="-2.800"><ele>10</ele></trkpt>
      <trkpt lat="47.605" lon="-2.805"><ele>12</ele></trkpt>
      <trkpt lat="47.610" lon="-2.810"><ele>10</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

  const defaultResult = parseGpxTrack(customHysteresisGpx);
  assert.equal(defaultResult.elevationGainM, 0);

  const customResult = parseGpxTrack(customHysteresisGpx, { elevationHysteresisMeters: 1.0 });
  assert.equal(customResult.elevationGainM, 2);
  assert.equal(customResult.elevationLossM, 2);
});

