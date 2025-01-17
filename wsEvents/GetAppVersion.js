const fetchURL = require('node-fetch');
const { load } = require('cheerio');
const os = require('os');
const getAppVersion = require('../utils/getAppVersion.js');
const downloadApp = require('../utils/downloadApp.js');
const { exec } = require('child_process');
const { promisify } = require('util');

const actualExec = promisify(exec);

async function getPage (pageUrl) {
  const pageRequest = await fetchURL(pageUrl, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
    }
  });
  return await pageRequest.text();
}

module.exports = async function (message, ws) {
  let versionsList;

  if (global.jarNames.isRooted && os.platform() !== 'android') {
    if (!global.jarNames.deviceID) {
      return ws.send(
        JSON.stringify({
          event: 'error',
          error:
            "You either don't have a device plugged in or don't have ADB installed."
        })
      );
    }

    actualExec('adb shell su -c exit').catch(() => {
      return ws.send(
        JSON.stringify({
          event: 'error',
          error:
            'The plugged in device is not rooted or Shell was denied root access. \
            If you didn\'t intend on doing a rooted build, include all "Root required to exclude" patches'
        })
      );
    });

    let pkgName;
    switch (global.jarNames.selectedApp) {
      case 'youtube': {
        pkgName = 'com.google.android.youtube';
        break;
      }
      case 'music': {
        pkgName = 'com.google.android.apps.youtube.music';
        break;
      }
    }
    const appVersion = await getAppVersion(pkgName);
    // if youtube isn't installed the function just returns null instead of erroring. i do not want to mess with regex's so i added this instead
    if (!appVersion) {
      return ws.send(
        JSON.stringify({
          event: 'error',
          error:
            "The app you selected is not installed on your device. It's needed for rooted ReVanced."
        })
      );
    }
    return await downloadApp(appVersion, ws);
  }

  switch (global.jarNames.selectedApp) {
    case 'youtube': {
      versionsList = await getPage(
        'https://www.apkmirror.com/apk/google-inc/youtube'
      );
      break;
    }
    case 'music': {
      versionsList = await getPage(
        'https://www.apkmirror.com/apk/google-inc/youtube-music'
      );
      break;
    }
    case 'android': {
      versionsList = await getPage(
        'https://www.apkmirror.com/apk/twitter/twitter'
      );
      break;
    }
    case 'frontpage': {
      versionsList = await getPage(
        'https://www.apkmirror.com/apk/redditinc/reddit'
      );
      break;
    }
    case 'warnapp': {
      versionsList = await getPage('https://www.apkmirror.com/apk/deutscher-wetterdienst/warnwetter');
      break;
    }
  }

  const versionList = [];
  let indx = 0;
  const $ = load(versionsList);

  for (const version of $(
    'h5[class="appRowTitle wrapText marginZero block-on-mobile"]'
  ).get()) {
    if (indx === 10) continue;
    const versionName = version.attribs.title
      .replace('YouTube ', '')
      .replace('Music ', '')
      .replace('Twitter ', '')
      .replace('Reddit ', '')
      .replace('WarnWetter ', '');

    indx++;
    if (versionName.includes('beta')) continue;
    else if (
      global.jarNames.selectedApp === 'android' &&
      !versionName.includes('release')
    ) {
      continue;
    }
    if (versionName.includes('(Wear OS)')) continue;
    versionList.push({
      version: versionName
    });
  }

  return ws.send(
    JSON.stringify({
      event: 'appVersions',
      versionList
    })
  );
};
