import { closeIntegrationPool } from '../lib/integration/db';
import { getRepository } from '../lib/repositories';
try { process.loadEnvFile('.env.local'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const repository=getRepository();
async function main() {
 console.log('Registros removidos:', await repository.cleanup());
 if ('db' in repository) repository.db.close();
 await closeIntegrationPool();
}
void main();
