const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER_BEGIN = '# BEGIN FLOWY PODFILE SIGNING FIX';
const MARKER_END = '# END FLOWY PODFILE SIGNING FIX';

const FIX_SNIPPET = `    ${MARKER_BEGIN}
    puts "[flowy] Applying Podfile signing fix to #{installer.pods_project.targets.length} pod targets..."
    bundles_patched = 0
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |c|
        is_bundle = c.build_settings['WRAPPER_EXTENSION'] == 'bundle' ||
                    (target.respond_to?(:product_type) && target.product_type == "com.apple.product-type.bundle")
        if is_bundle
          c.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
          c.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
          c.build_settings['CODE_SIGN_IDENTITY'] = ''
          c.build_settings['EXPANDED_CODE_SIGN_IDENTITY'] = ''
          bundles_patched += 1
        end
      end
    end
    puts "[flowy] Podfile signing fix: disabled signing on #{bundles_patched} bundle build configurations"
    ${MARKER_END}`;

const POST_INSTALL_REGEX = /(post_install do \|installer\|)([\s\S]*?)(\n[ \t]*end[ \t]*\n)/;

const withPodfileSigningFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        console.log('[withPodfileSigningFix] Podfile not found, skipping');
        return cfg;
      }

      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER_BEGIN)) {
        console.log('[withPodfileSigningFix] marker already present, skipping');
        return cfg;
      }

      const match = contents.match(POST_INSTALL_REGEX);
      if (!match) {
        throw new Error(
          'withPodfileSigningFix: could not find `post_install do |installer|` block in Podfile',
        );
      }

      const [full, head, body, tail] = match;
      const patched = `${head}${body}\n${FIX_SNIPPET}${tail}`;
      contents = contents.replace(full, patched);
      fs.writeFileSync(podfilePath, contents);
      console.log('[withPodfileSigningFix] Podfile patched with signing fix');
      return cfg;
    },
  ]);
};

module.exports = withPodfileSigningFix;
module.exports.default = withPodfileSigningFix;
