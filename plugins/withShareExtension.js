const {
  IOSConfig,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  appGroup: 'group.app.tryflowy',
  extensionName: 'ShareExtension',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://tryflowy.app',
  // PocketBase URL the extension PATCHes to commit picker-selected tags
  // onto the new item (option (b) of the tag-attach flow). Defaults to the
  // same localhost:8090 the web app uses; prod deployments should set
  // EXPO_PUBLIC_PB_URL (or pass pbUrl in the plugin props) to whatever
  // public PB endpoint they expose.
  pbUrl: process.env.EXPO_PUBLIC_PB_URL || 'http://localhost:8090',
};

function resolveProps(props) {
  const p = props || {};
  return {
    appGroup: p.appGroup || DEFAULTS.appGroup,
    extensionName: p.extensionName || DEFAULTS.extensionName,
    apiBaseUrl: p.apiBaseUrl || DEFAULTS.apiBaseUrl,
    pbUrl: p.pbUrl || DEFAULTS.pbUrl,
  };
}

const TEMPLATE_DIR = path.join(__dirname, 'shareExtensionTemplate');
const TEMPLATE_FONTS_DIR = path.join(TEMPLATE_DIR, 'Fonts');
const FONTS_SUBDIR = 'Fonts';

function withMainEntitlements(config, props) {
  return withEntitlementsPlist(config, (cfg) => {
    const r = cfg.modResults;
    const groups = Array.isArray(r['com.apple.security.application-groups'])
      ? r['com.apple.security.application-groups']
      : [];
    if (!groups.includes(props.appGroup)) groups.push(props.appGroup);
    r['com.apple.security.application-groups'] = groups;

    const kgs = Array.isArray(r['keychain-access-groups']) ? r['keychain-access-groups'] : [];
    const kg = `$(AppIdentifierPrefix)${props.appGroup}`;
    if (!kgs.includes(kg)) kgs.push(kg);
    r['keychain-access-groups'] = kgs;
    return cfg;
  });
}

function withMainInfoPlist(config, props) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.API_BASE_URL = props.apiBaseUrl;
    cfg.modResults.APP_GROUP = props.appGroup;
    // PB_URL is read by the share extension's tag-commit PATCH. Also
    // mirrored here so the main app can read it (e.g. future RN code that
    // wants to surface the same endpoint).
    cfg.modResults.PB_URL = props.pbUrl;
    return cfg;
  });
}

function listTemplateSwiftFiles() {
  if (!fs.existsSync(TEMPLATE_DIR)) return [];
  return fs
    .readdirSync(TEMPLATE_DIR)
    .filter((n) => n.endsWith('.swift'))
    .sort();
}

// Fonts bundled into the extension (currently just Instrument Serif, used
// by the SuccessView tagline). Lives in a sibling Fonts/ subdir so it can
// be a separate PBXGroup in Xcode. Memory floor matters — each .ttf gets
// memory-mapped at extension launch; we keep this to 2 weights / ~140KB.
function listTemplateFontFiles() {
  if (!fs.existsSync(TEMPLATE_FONTS_DIR)) return [];
  return fs
    .readdirSync(TEMPLATE_FONTS_DIR)
    .filter((n) => n.endsWith('.ttf') || n.endsWith('.otf'))
    .sort();
}

function withShareExtensionSources(config, props) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const targetDir = path.join(iosRoot, props.extensionName);
      fs.mkdirSync(targetDir, { recursive: true });

      const swiftFiles = listTemplateSwiftFiles();
      const files = {
        'Info.plist': renderInfoPlist(props),
        [`${props.extensionName}.entitlements`]: renderEntitlements(props),
      };

      // For each .swift in the template, write it to ios/. If a hand-edited
      // copy already lives in ios/ShareExtension/, prefer that — the dev
      // workflow iterates on ios/ directly and we don't want prebuild to
      // clobber in-flight work. Same pattern that already protected
      // ShareViewController.swift; now generalized to every Swift file.
      for (const name of swiftFiles) {
        const repoCopy = path.join(projectRoot, 'ios', props.extensionName, name);
        const templateCopy = path.join(TEMPLATE_DIR, name);
        files[name] = fs.existsSync(repoCopy)
          ? fs.readFileSync(repoCopy, 'utf8')
          : fs.readFileSync(templateCopy, 'utf8');
      }

      for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(targetDir, name), content);
      }

      // Mirror bundled font binaries (Instrument Serif) under
      // ios/ShareExtension/Fonts/. Unlike .swift files we always overwrite
      // — fonts are pristine binaries and there's no in-flight edit risk.
      const fonts = listTemplateFontFiles();
      if (fonts.length > 0) {
        const fontsTargetDir = path.join(targetDir, FONTS_SUBDIR);
        fs.mkdirSync(fontsTargetDir, { recursive: true });
        for (const fname of fonts) {
          fs.copyFileSync(
            path.join(TEMPLATE_FONTS_DIR, fname),
            path.join(fontsTargetDir, fname),
          );
        }
      }

      return cfg;
    },
  ]);
}

function enableMacCatalystOnMainTarget(project) {
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const key in configurations) {
    const c = configurations[key];
    if (!c || typeof c !== 'object' || !c.buildSettings) continue;
    const productName = (c.buildSettings.PRODUCT_NAME || '').replace(/"/g, '');
    if (productName === 'Tryflowy' || c.buildSettings.PRODUCT_NAME === '"$(TARGET_NAME)"') {
      c.buildSettings.SUPPORTS_MACCATALYST = 'YES';
      c.buildSettings.DERIVE_MACCATALYST_PRODUCT_BUNDLE_IDENTIFIER = 'YES';
      c.buildSettings.SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = 'NO';
    }
  }
}

function findGroupKeyByName(project, name) {
  const groups = project.hash.project.objects.PBXGroup || {};
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    if (!g || typeof g !== 'object') continue;
    if (g.name === name || g.path === name) return key;
  }
  return null;
}

function sourceFileAlreadyAdded(project, fileName) {
  const refs = project.hash.project.objects.PBXFileReference || {};
  for (const key of Object.keys(refs)) {
    const r = refs[key];
    if (r && typeof r === 'object' && (r.name === fileName || r.path === fileName)) {
      return true;
    }
  }
  return false;
}

function ensureShareExtensionSwiftFiles(project, targetUuid, targetName) {
  const groupKey = findGroupKeyByName(project, targetName);
  if (!groupKey) return;
  for (const swift of listTemplateSwiftFiles()) {
    if (sourceFileAlreadyAdded(project, swift)) continue;
    project.addSourceFile(swift, { target: targetUuid }, groupKey);
  }
}

// Idempotently registers .ttf/.otf files in plugins/shareExtensionTemplate/Fonts/
// as resources of the extension target. Nests them under a "Fonts" PBXGroup
// inside the extension's main group on first run; reuses it on subsequent
// prebuilds. addResourceFile auto-appends to PBXResourcesBuildPhase for
// the given target, so we don't manage the build phase manually.
//
// One wart: xcode-lib's addResourceFile → correctForResourcesPath calls
// `pbxGroupByName('Resources')` and crashes if no group has that exact
// name. We pre-create a phantom Resources group (with no path) so the
// lookup succeeds and file paths are not mangled. The phantom isn't wired
// into the project tree — it just needs to exist in the PBXGroup section.
function ensureResourcesGroupExists(project) {
  if (project.pbxGroupByName('Resources')) return;
  // pbxCreateGroup(name, path) — empty path means correctForPath's
  // `if (section.path)` short-circuits and leaves file.path untouched.
  project.pbxCreateGroup('Resources', '');
}

function ensureShareExtensionFontFiles(project, targetUuid, targetName) {
  const fonts = listTemplateFontFiles();
  if (fonts.length === 0) return;
  const parentGroupKey = findGroupKeyByName(project, targetName);
  if (!parentGroupKey) return;

  ensureResourcesGroupExists(project);

  let fontsGroupKey = findGroupKeyByName(project, FONTS_SUBDIR);
  if (!fontsGroupKey) {
    const fontsGroup = project.pbxCreateGroup(FONTS_SUBDIR, FONTS_SUBDIR);
    project.addToPbxGroup(fontsGroup, parentGroupKey);
    fontsGroupKey = fontsGroup;
  }

  for (const fname of fonts) {
    if (sourceFileAlreadyAdded(project, fname)) continue;
    project.addResourceFile(fname, { target: targetUuid }, fontsGroupKey);
  }
}

function withShareExtensionTarget(config, props) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    enableMacCatalystOnMainTarget(project);
    const targetName = props.extensionName;
    const teamId = cfg.ios && cfg.ios.appleTeamId;

    let targetUuid;
    const existingTargetKey = project.findTargetKey(targetName);
    if (existingTargetKey) {
      targetUuid = existingTargetKey;
      // Target was created on a prior prebuild — make sure any new Swift
      // files added since then are registered as sources too, and any new
      // fonts get added to the Resources build phase.
      ensureShareExtensionSwiftFiles(project, targetUuid, targetName);
      ensureShareExtensionFontFiles(project, targetUuid, targetName);
    } else {
      const mainBundleId =
        (cfg.ios && cfg.ios.bundleIdentifier) ||
        IOSConfig.BundleIdentifier.getBundleIdentifier(cfg) ||
        'app.tryflowy.client';
      const extBundleId = `${mainBundleId}.${targetName}`;

      const target = project.addTarget(targetName, 'app_extension', targetName, extBundleId);
      targetUuid = target.uuid;

      project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', targetUuid);
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetUuid);
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetUuid);

      const groupKey = project.pbxCreateGroup(targetName, targetName);
      project.addToPbxGroup(groupKey, project.getFirstProject().firstProject.mainGroup);

      // Add every Swift file that lives in the template directory. The
      // legacy plugin only registered ShareViewController.swift — now the
      // success screen, view model, mesh background, and tag picker all
      // get wired up automatically.
      const swiftFiles = listTemplateSwiftFiles();
      const sourcesToAdd = swiftFiles.length > 0 ? swiftFiles : ['ShareViewController.swift'];
      for (const swift of sourcesToAdd) {
        project.addSourceFile(swift, { target: targetUuid }, groupKey);
      }
      // Register bundled fonts (Fonts/*.ttf) — creates the nested Fonts
      // group and adds to the existing PBXResourcesBuildPhase via the
      // xcode addResourceFile API.
      ensureShareExtensionFontFiles(project, targetUuid, targetName);
      // Info.plist is wired via INFOPLIST_FILE, not as a resource
    }

    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const c = configurations[key];
      if (!c || typeof c !== 'object' || !c.buildSettings) continue;
      const productName = (c.buildSettings.PRODUCT_NAME || '').replace(/"/g, '');
      if (productName === targetName) {
        c.buildSettings.CODE_SIGN_ENTITLEMENTS = `${targetName}/${targetName}.entitlements`;
        c.buildSettings.SWIFT_VERSION = '5.0';
        // iOS 17 is the floor for PhaseAnimator, .presentationDetents,
        // .symbolEffect, .snappy/.bouncy springs — all used by the
        // MyMind-style success screen. Main app target still on 15.1.
        c.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '17.0';
        c.buildSettings.INFOPLIST_FILE = `${targetName}/Info.plist`;
        c.buildSettings.SUPPORTS_MACCATALYST = 'YES';
        c.buildSettings.DERIVE_MACCATALYST_PRODUCT_BUNDLE_IDENTIFIER = 'YES';
        c.buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
        if (teamId) {
          c.buildSettings.DEVELOPMENT_TEAM = teamId;
          c.buildSettings.CODE_SIGN_STYLE = 'Manual';
        }
      }
    }

    return cfg;
  });
}

function renderUIAppFontsBlock() {
  const fonts = listTemplateFontFiles();
  if (fonts.length === 0) return '';
  const items = fonts.map((f) => `    <string>${f}</string>`).join('\n');
  return `  <key>UIAppFonts</key>\n  <array>\n${items}\n  </array>\n`;
}

function renderInfoPlist(props) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${renderUIAppFontsBlock()}  <key>CFBundleDisplayName</key>
  <string>Tryflowy</string>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>API_BASE_URL</key>
  <string>${props.apiBaseUrl}</string>
  <key>APP_GROUP</key>
  <string>${props.appGroup}</string>
  <key>PB_URL</key>
  <string>${props.pbUrl}</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionAttributes</key>
    <dict>
      <key>NSExtensionActivationRule</key>
      <dict>
        <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
        <integer>1</integer>
        <key>NSExtensionActivationSupportsImageWithMaxCount</key>
        <integer>10</integer>
        <key>NSExtensionActivationSupportsMovieWithMaxCount</key>
        <integer>1</integer>
        <key>NSExtensionActivationSupportsFileWithMaxCount</key>
        <integer>10</integer>
        <key>NSExtensionActivationSupportsText</key>
        <true/>
      </dict>
    </dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.share-services</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
  </dict>
</dict>
</plist>
`;
}

function renderEntitlements(props) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${props.appGroup}</string>
  </array>
  <key>keychain-access-groups</key>
  <array>
    <string>$(AppIdentifierPrefix)${props.appGroup}</string>
  </array>
</dict>
</plist>
`;
}

const withShareExtension = (config, props) => {
  const resolved = resolveProps(props);
  config = withMainEntitlements(config, resolved);
  config = withMainInfoPlist(config, resolved);
  config = withShareExtensionSources(config, resolved);
  config = withShareExtensionTarget(config, resolved);
  return config;
};

module.exports = withShareExtension;
module.exports.default = withShareExtension;
