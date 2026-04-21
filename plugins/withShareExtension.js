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
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000',
};

function resolveProps(props) {
  const p = props || {};
  return {
    appGroup: p.appGroup || DEFAULTS.appGroup,
    extensionName: p.extensionName || DEFAULTS.extensionName,
    apiBaseUrl: p.apiBaseUrl || DEFAULTS.apiBaseUrl,
  };
}

const TEMPLATE_DIR = path.join(__dirname, 'shareExtensionTemplate');

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
    return cfg;
  });
}

function withShareExtensionSources(config, props) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const targetDir = path.join(iosRoot, props.extensionName);
      fs.mkdirSync(targetDir, { recursive: true });

      const files = {
        'ShareViewController.swift': renderShareViewController(props),
        'Info.plist': renderInfoPlist(props),
        [`${props.extensionName}.entitlements`]: renderEntitlements(props),
      };

      const repoSwift = path.join(
        projectRoot,
        'ios',
        props.extensionName,
        'ShareViewController.swift',
      );
      if (fs.existsSync(repoSwift)) {
        files['ShareViewController.swift'] = fs.readFileSync(repoSwift, 'utf8');
      }

      for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(targetDir, name), content);
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

function withShareExtensionTarget(config, props) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    enableMacCatalystOnMainTarget(project);
    const targetName = props.extensionName;
    if (project.findTargetKey(targetName)) return cfg;

    const mainBundleId =
      (cfg.ios && cfg.ios.bundleIdentifier) ||
      IOSConfig.BundleIdentifier.getBundleIdentifier(cfg) ||
      'app.tryflowy.client';
    const extBundleId = `${mainBundleId}.${targetName}`;

    const target = project.addTarget(targetName, 'app_extension', targetName, extBundleId);
    const targetUuid = target.uuid;

    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', targetUuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetUuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetUuid);

    const groupKey = project.pbxCreateGroup(targetName, targetName);
    project.addToPbxGroup(groupKey, project.getFirstProject().firstProject.mainGroup);
    project.addSourceFile(
      'ShareViewController.swift',
      { target: targetUuid },
      groupKey,
    );
    // Info.plist is wired via INFOPLIST_FILE, not as a resource

    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const c = configurations[key];
      if (!c || typeof c !== 'object' || !c.buildSettings) continue;
      const productName = (c.buildSettings.PRODUCT_NAME || '').replace(/"/g, '');
      if (productName === targetName) {
        c.buildSettings.CODE_SIGN_ENTITLEMENTS = `${targetName}/${targetName}.entitlements`;
        c.buildSettings.SWIFT_VERSION = '5.0';
        c.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '15.1';
        c.buildSettings.INFOPLIST_FILE = `${targetName}/Info.plist`;
        c.buildSettings.SUPPORTS_MACCATALYST = 'YES';
        c.buildSettings.DERIVE_MACCATALYST_PRODUCT_BUNDLE_IDENTIFIER = 'YES';
        c.buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
      }
    }

    return cfg;
  });
}

function renderInfoPlist(props) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
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
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionAttributes</key>
    <dict>
      <key>NSExtensionActivationRule</key>
      <dict>
        <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
        <integer>1</integer>
        <key>NSExtensionActivationSupportsImageWithMaxCount</key>
        <integer>1</integer>
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

function renderShareViewController() {
  const p = path.join(TEMPLATE_DIR, 'ShareViewController.swift');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  throw new Error('ShareViewController.swift template missing');
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
