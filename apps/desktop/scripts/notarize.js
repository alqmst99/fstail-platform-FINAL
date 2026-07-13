/**
 * apps/desktop/scripts/notarize.js
 * macOS notarization — runs as electron-builder afterSign hook.
 * Only executes on macOS CI builds (requires Apple credentials in env).
 *
 * Required env vars (set in GitHub Actions secrets):
 *   APPLE_ID            — your Apple ID email
 *   APPLE_APP_SPECIFIC_PASSWORD — app-specific password from appleid.apple.com
 *   APPLE_TEAM_ID       — 10-char team ID from developer.apple.com
 */

const { notarize } = require('@electron/notarize');

exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') return;

  // Skip if Apple credentials not present (local dev builds)
  if (!process.env.APPLE_ID) {
    console.log('Skipping notarization — APPLE_ID not set');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath}…`);

  await notarize({
    tool: 'notarytool',
    appPath,
    appleId:             process.env.APPLE_ID,
    appleIdPassword:     process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId:              process.env.APPLE_TEAM_ID,
  });

  console.log('Notarization complete');
};
