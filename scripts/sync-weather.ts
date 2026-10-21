import { syncWeatherSnapshots } from '../src/lib/open-meteo.js';

async function main() {
  console.log('--- Synchronisation Météo Open-Meteo AROME (6 secteurs) ---');
  const start = Date.now();
  const report = await syncWeatherSnapshots();
  const duration = Date.now() - start;

  console.log(`Statut : ${report.success ? 'SUCCÈS' : 'AVERTISSEMENT / ERREUR PARTIELLE'}`);
  console.log(`Secteurs mis à jour : ${report.sectorsUpdated} / 6`);
  console.log(`Durée : ${duration}ms`);

  if (report.errors.length > 0) {
    console.error('Erreurs rencontrées :');
    for (const e of report.errors) {
      console.error(`- [${e.sector}] : ${e.error}`);
    }
  }

  process.exit(report.success ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal sync-weather error:', err);
  process.exit(1);
});
