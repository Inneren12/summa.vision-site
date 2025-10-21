import path from 'node:path';
import { fileURLToPath } from 'node:url';
import StyleDictionary from 'style-dictionary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../style-dictionary.config.cjs');
const dictionary = StyleDictionary.extend(configPath);

console.log('Cleaning previous token outputs...');
dictionary.cleanAllPlatforms();

console.log('Building tokens for all platforms...');
dictionary.buildAllPlatforms();

console.log('Token build complete.');
