#!/usr/bin/env node
/**
 * apps/desktop/scripts/release.js
 * Bump version, tag, and push to trigger the GitHub Actions release workflow.
 *
 * Usage:
 *   node scripts/release.js patch   → 1.0.0 → 1.0.1
 *   node scripts/release.js minor   → 1.0.0 → 1.1.0
 *   node scripts/release.js major   → 1.0.0 → 2.0.0
 *   node scripts/release.js 1.2.3   → 1.0.0 → 1.2.3 (explicit)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const bump = process.argv[2];
if (!bump) {
  console.error('Usage: node release.js [patch|minor|major|x.y.z]');
  process.exit(1);
}

function bumpVersion(current, type) {
  if (/^\d+\.\d+\.\d+$/.test(type)) return type;
  const [major, minor, patch] = current.split('.').map(Number);
  switch (type) {
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'major': return `${major + 1}.0.0`;
    default:
      console.error(`Unknown bump type: ${type}`);
      process.exit(1);
  }
}

const newVersion = bumpVersion(pkg.version, bump);

// Confirm
console.log(`\nBumping: ${pkg.version} → ${newVersion}`);
console.log('This will:');
console.log(`  1. Update package.json`);
console.log(`  2. Commit and tag v${newVersion}`);
console.log(`  3. Push to origin/main — triggers GitHub Actions release build`);
console.log('');

const readline = require('readline').createInterface({
  input: process.stdin, output: process.stdout,
});

readline.question('Continue? (y/N) ', (answer) => {
  readline.close();
  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted.');
    process.exit(0);
  }

  try {
    // 1. Update package.json
    pkg.version = newVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

    // 2. Commit
    execSync('git add package.json', { stdio: 'inherit' });
    execSync(`git commit -m "chore(desktop): release v${newVersion}"`, { stdio: 'inherit' });

    // 3. Tag
    execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { stdio: 'inherit' });

    // 4. Push
    execSync('git push origin main --follow-tags', { stdio: 'inherit' });

    console.log(`\n✅ Released v${newVersion}`);
    console.log('GitHub Actions will build and publish the installers.');
    console.log(`Track progress at: https://github.com/fstail-solutions/fstail-platform/actions`);
  } catch (err) {
    console.error('\n❌ Release failed:', err.message);
    process.exit(1);
  }
});
