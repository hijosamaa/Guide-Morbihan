import { syncOsmData } from '../src/lib/overpass.js';

async function main() {
  console.log('--- Synchronisation OpenStreetMap Overpass (Cales & Équipements) ---');
  const start = Date.now();
  const report = await syncOsmData();
  const duration = Date.now() - start;

  console.log(`Statut : ${report.success ? 'SUCCÈS' : 'ÉCHEC OU ERREUR PARTIELLE'}`);
  console.log(`Éléments analysés : ${report.totalParsed}`);
  console.log(`Cales nautiques enregistrées : ${report.slipwaysUpserted}`);
  console.log(`Équipements de plein air enregistrés : ${report.amenitiesUpserted}`);
  console.log(`Durée : ${duration}ms`);

  if (report.errors.length > 0) {
    console.error(`Erreurs (${report.errors.length}) :`, report.errors.slice(0, 5));
  }

  process.exit(report.success ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal sync-osm error:', err);
  process.exit(1);
});
