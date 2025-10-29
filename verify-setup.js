#!/usr/bin/env node

import 'dotenv/config';
import { readFileSync } from 'fs';

console.log('\n🔍 Cartesia Conversation Demo - Setup Verification\n');

let hasErrors = false;

// Check Node version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

console.log('✓ Node.js version:', nodeVersion);

if (majorVersion < 18) {
  console.error('❌ ERROR: Node.js 18+ required. Please upgrade Node.js');
  hasErrors = true;
}

// Check package.json
try {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
  console.log('✓ Package.json found');
  console.log('  Project:', pkg.name, 'v' + pkg.version);
} catch (error) {
  console.error('❌ ERROR: Cannot read package.json');
  hasErrors = true;
}

// Check required files
const requiredFiles = [
  'src/server.js',
  'public/index.html',
  'public/app.js',
  '.env.example',
];

console.log('\n📁 Checking required files:');
for (const file of requiredFiles) {
  try {
    readFileSync(file);
    console.log(`  ✓ ${file}`);
  } catch (error) {
    console.error(`  ❌ Missing: ${file}`);
    hasErrors = true;
  }
}

// Check .env file
console.log('\n🔑 Checking environment variables:');
try {
  readFileSync('.env');
  console.log('  ✓ .env file exists');
} catch (error) {
  console.error('  ❌ .env file not found');
  console.log('  → Run: cp .env.example .env');
  hasErrors = true;
}

// Validate API keys
const requiredEnvVars = {
  CARTESIA_API_KEY: 'Cartesia API Key',
  OPENAI_API_KEY: 'OpenAI API Key',
  CARTESIA_API_VERSION: 'Cartesia API Version',
  PORT: 'Server Port',
};

console.log('\n🔐 Environment variables status:');
for (const [key, description] of Object.entries(requiredEnvVars)) {
  const value = process.env[key];

  if (!value) {
    console.error(`  ❌ Missing: ${key} (${description})`);
    hasErrors = true;
  } else if (value.includes('your_') || value.includes('_here')) {
    console.error(`  ⚠️  Not configured: ${key} (${description})`);
    console.log(`     Current value: ${value}`);
    hasErrors = true;
  } else {
    const maskedValue = value.length > 10
      ? value.slice(0, 8) + '...' + value.slice(-4)
      : '***';
    console.log(`  ✓ ${key}: ${maskedValue}`);
  }
}

// Check dependencies
console.log('\n📦 Checking dependencies:');
try {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
  const deps = pkg.dependencies || {};
  const requiredDeps = ['express', 'ws', 'openai', 'dotenv'];

  for (const dep of requiredDeps) {
    if (deps[dep]) {
      console.log(`  ✓ ${dep} (${deps[dep]})`);
    } else {
      console.error(`  ❌ Missing: ${dep}`);
      hasErrors = true;
    }
  }

  try {
    readFileSync('./node_modules/express/package.json');
    console.log('\n  ✓ Dependencies installed');
  } catch {
    console.error('\n  ❌ Dependencies not installed');
    console.log('  → Run: npm install');
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ Cannot check dependencies');
  hasErrors = true;
}

// Final summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('\n❌ SETUP INCOMPLETE - Please fix the errors above\n');
  console.log('Quick fixes:');
  console.log('  1. Copy environment file: cp .env.example .env');
  console.log('  2. Edit .env and add your API keys');
  console.log('  3. Install dependencies: npm install');
  console.log('  4. Run this script again: node verify-setup.js\n');
  process.exit(1);
} else {
  console.log('\n✅ ALL CHECKS PASSED - Ready to start!\n');
  console.log('Run the application:');
  console.log('  npm start\n');
  console.log('Then open: http://localhost:' + (process.env.PORT || 3000) + '\n');
  process.exit(0);
}
