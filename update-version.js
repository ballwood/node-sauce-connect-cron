var request = require('request');
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var config = require('./config.json');
var omit = require('lodash/omit');
var pick = require('lodash/pick');
var expect = require('chai').expect;

console.log('Checking out current codebase');

cp.spawnSync('git', ['clone', config.gitUrl, config.checkoutDir]);

console.log('Retrieving: https://saucelabs.com/versions.json');

var currentVersion = require('./workspace/manifest.json').version;
var packageJson = require('./workspace/package.json');

function writeFile(filename, contents) {
  return new Promise(function (resolve, reject) {

    fs.writeFile(filename, contents, function (err) {

      if (err) {
        return reject('Could not write to ./workspace/package.json: ' + err);
      }

      resolve();

    });

  })
}

function createNewBranch(workspace, branchName) {
  cp.spawnSync('git', ['branch', branchName], {
    cwd: workspace
  });
}

function gitBranchExists(repo, branchName) {

  const result = cp.spawnSync('git', ['ls-remote', '--exit-code', '--heads', repo, branchName, '>', '/dev/null']);

  if (result.status !== 2) {
    return true;
  }

  return false;
}

function checkoutBranch(workspace, branchName) {
  cp.spawnSync('git', ['checkout', branchName], {
    cwd: workspace
  });
}

function commitAll(workspace, message) {
  cp.spawnSync('git', ['add', '-A'], {
    cwd: workspace
  });
  cp.spawnSync('git', ['commit', '-m', message], {
    cwd: workspace
  });
}

function pushBranch(workspace, branchName) {
  cp.spawnSync('git', ['push', 'origin', branchName], {
    cwd: workspace
  });
}

request('https://saucelabs.com/versions.json', function (error, response, body) {

  var parsedBody;
  var version;

  if (error) {
    console.log('Error getting Sauce Connect version: ' + error);
    process.exit(1);
  }

  try {
    parsedBody = JSON.parse(body);
  } catch (e) {
    console.log('Could not parse Sauce Connect JSON: ' + e);
    process.exit(1);
  }

  version = parsedBody && parsedBody['Sauce Connect'] && parsedBody['Sauce Connect'].version;

  if (!version) {
    console.log('Sauce Connect JSON did not have a version field:');
    console.log(JSON.stringify(parsedBody));
    process.exit(1);
  }

  if (currentVersion === version) {
    console.log('No new Sauce Connect version. Exiting');
    process.exit(0);
  }

  console.log('Updated version of Sauce Connect available');
  console.log('Writing version.js with:', version);

  if (gitBranchExists(config.gitUrl, version)) {
    // make commits to original branch if theres been updates
    checkoutBranch(config.checkoutDir, version);
  }

  var newManifest = parsedBody['Sauce Connect'];

  delete newManifest.download_url;

  const keys = Object.keys(newManifest);

  keys.forEach((key) => {
    if (key == 'version') return;
    newManifest[key] = pick(newManifest[key], ['download_url', 'sha1']);
  });

  const manifestFilename = path.join(__dirname, config.checkoutDir, 'manifest.json');;
  const manifestContents = JSON.stringify(newManifest, null, 2);

  packageJson.version = parsedBody['Sauce Connect'].version;

  const packageFilename = path.join(__dirname, config.checkoutDir, 'package.json');
  const packageContents = JSON.stringify(packageJson, null, 2);

  writeFile(manifestFilename, manifestContents)
  .then(() => writeFile(packageFilename, packageContents))
  .then(() => {
    createNewBranch(config.checkoutDir, version);
    checkoutBranch(config.checkoutDir, version);
    commitAll(config.checkoutDir, `node-sauce-connect-cron: updating to ${version}`);
    pushBranch(config.checkoutDir, version);
  }).catch((err) => {
    console.log(err);
    process.exit(1);
  });

});

