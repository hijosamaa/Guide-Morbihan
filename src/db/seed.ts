import { db, pool } from './index';
import { places, tideEvents, weatherSnapshots } from './schema';
import { seedPlaces, seedTides, seedWeather } from './seed-data';

async function runSeed() {
  console.log('🌊 Démarrage du seed pour le Guide Morbihan...');

  // 1. Insertion des Lieux (places)
  console.log(`📍 Insertion de ${seedPlaces.length} lieux de référence...`);
  for (const place of seedPlaces) {
    await db
      .insert(places)
      .values(place)
      .onConflictDoUpdate({
        target: places.slug,
        set: {
          name: place.name,
          shortDescription: place.shortDescription,
          fullDescription: place.fullDescription,
          category: place.category,
          commune: place.commune,
          communeSlug: place.communeSlug,
          sector: place.sector,
          latitude: place.latitude,
          longitude: place.longitude,
          parkingLat: place.parkingLat,
          parkingLng: place.parkingLng,
          contextualRules: place.contextualRules,
          trailData: place.trailData,
          isSponsored: place.isSponsored,
          affiliateBookingUrl: place.affiliateBookingUrl,
          affiliateLabel: place.affiliateLabel,
          updatedAt: new Date(),
        },
      });
  }
  console.log('✅ Lieux insérés avec succès.');

  // 2. Insertion des Événements de Marée
  console.log(`⏱️ Insertion de ${seedTides.length} événements de marées...`);
  for (const tide of seedTides) {
    await db.insert(tideEvents).values(tide).onConflictDoNothing();
  }
  console.log('✅ Événements de marée insérés.');

  // 3. Insertion des Instantanés Météo
  console.log(`⛅ Insertion de ${seedWeather.length} instantanés météo...`);
  for (const weather of seedWeather) {
    await db
      .insert(weatherSnapshots)
      .values(weather)
      .onConflictDoUpdate({
        target: weatherSnapshots.sector,
        set: {
          tempCelsius: weather.tempCelsius,
          windSpeedKnots: weather.windSpeedKnots,
          windDirectionDeg: weather.windDirectionDeg,
          windCardinal: weather.windCardinal,
          weatherCode: weather.weatherCode,
          isRaining: weather.isRaining,
          updatedAt: new Date(),
        },
      });
  }
  console.log('✅ Instantanés météo insérés.');

  console.log('🎉 Seed multi-zones terminé avec succès !');
}

runSeed()
  .catch((err) => {
    console.error('❌ Erreur lors du seed :', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
