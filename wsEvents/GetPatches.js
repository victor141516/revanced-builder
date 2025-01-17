const { promisify } = require('util');
const { exec } = require('child_process');
const { getPatchList } = require('../utils/PatchListRememberer.js');
const os = require('os');
const actualExec = promisify(exec);

const rootedPatches = [
  'microg-support',
  'hide-cast-button',
  'music-microg-support'
];

module.exports = async function(message, ws) {
  const patchList = [];
  const getPatches = await actualExec(
    `java -jar ${global.jarNames.cli} -a ${global.jarNames.integrations} -b ${global.jarNames.patchesJar} -l --with-packages`
  );
  const patchesText = getPatches.stdout;
  const matches = patchesText.matchAll(/:\s+(?<pkg>\S+)\s+(?<name>\S+)\s+(?<description>.+)/g);

  let hasRoot = true;
  if (os.platform() === 'android') {
    await actualExec('su -c exit').catch((err) => {
      const error = err.stderr || err.stdout;
      if (
        error.includes('No su program found on this device.') ||
        error.includes('Permission denied')
      ) {
        hasRoot = false;
      }
    });
  }

  for (const match of matches) {
    const { name, description, pkg } = match.groups;
    const isRooted = rootedPatches.includes(name);
    const isCompatible = pkg === global.jarNames.selectedApp;

    if (isCompatible && (!isRooted || hasRoot)) {
      patchList.push({ name, description: description.trim(), isRooted });
    }
  }

  const rememberedPatchList = getPatchList(global.jarNames.selectedApp);

  return ws.send(
    JSON.stringify({
      event: 'patchList',
      patchList,
      rememberedPatchList
    })
  );
};
