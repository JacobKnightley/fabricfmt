#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const CORE_PKG = path.join(__dirname, '../packages/core/package.json');
const CHROMIUM_PKG = path.join(__dirname, '../packages/chromium/package.json');

function readVersion(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

function writeVersion(pkgPath, version) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default: return current;
  }
}

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const coreVersion = readVersion(CORE_PKG);
  const chromiumVersion = readVersion(CHROMIUM_PKG);

  console.log('\n📦 fabricfmt Release Tool\n');
  console.log(`  Core:     v${coreVersion}`);
  console.log(`  Chromium: v${chromiumVersion}\n`);

  const choice = await prompt(rl, 'Release: (1) Core, (2) Chromium, (3) Both, (q) Quit: ');

  if (choice === 'q' || choice === 'Q') {
    console.log('Cancelled.');
    rl.close();
    return;
  }

  const releaseCore = choice === '1' || choice === '3';
  const releaseChromium = choice === '2' || choice === '3';

  if (!releaseCore && !releaseChromium) {
    console.log('Invalid choice.');
    rl.close();
    return;
  }

  const bumpType = await prompt(rl, 'Bump type: (1) patch, (2) minor, (3) major: ');
  const type = bumpType === '1' ? 'patch' : bumpType === '2' ? 'minor' : bumpType === '3' ? 'major' : null;

  if (!type) {
    console.log('Invalid bump type.');
    rl.close();
    return;
  }

  const tags = [];

  if (releaseCore) {
    const newVersion = bumpVersion(coreVersion, type);
    console.log(`\n  Core: ${coreVersion} → ${newVersion}`);
    writeVersion(CORE_PKG, newVersion);
    tags.push(`core@${newVersion}`);
  }

  if (releaseChromium) {
    const newVersion = bumpVersion(chromiumVersion, type);
    console.log(`  Chromium: ${chromiumVersion} → ${newVersion}`);
    writeVersion(CHROMIUM_PKG, newVersion);
    // Also update manifest.json
    const manifestPath = path.join(__dirname, '../packages/chromium/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.version = newVersion;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    tags.push(`chromium@${newVersion}`);
  }

  const confirm = await prompt(rl, '\nCommit changes? (y/n): ');
  rl.close();

  if (confirm !== 'y' && confirm !== 'Y') {
    console.log('Cancelled. Version files updated but not committed.');
    return;
  }

  try {
    // Stage and commit
    execSync('git add packages/core/package.json packages/chromium/package.json packages/chromium/manifest.json', { stdio: 'inherit' });
    execSync(`git commit -m "release: ${tags.join(', ')}"`, { stdio: 'inherit' });

    console.log('\n✅ Done! Now:');
    console.log('   1. Push your branch: git push');
    console.log('   2. Create PR to main');
    console.log('   3. On merge, tags are created automatically\n');
  } catch (err) {
    console.error('Git command failed:', err.message);
  }
}

main();
