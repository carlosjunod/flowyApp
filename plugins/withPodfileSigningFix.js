const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER_BEGIN = '# BEGIN FLOWY PODFILE SIGNING FIX';
const MARKER_END = '# END FLOWY PODFILE SIGNING FIX';

const FIX_SNIPPET = `    ${MARKER_BEGIN}
    installer.pods_project.targets.each do |target|
      if target.respond_to?(:product_type) && target.product_type == "com.apple.product-type.bundle"
        target.build_configurations.each do |c|
          c.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        end
      end
    end
    ${MARKER_END}`;

const POST_INSTALL_REGEX = /(post_install do \|installer\|)([\s\S]*?)(\n[ \t]*end[ \t]*\n)/;

const withPodfileSigningFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return cfg;

      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER_BEGIN)) return cfg;

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
      return cfg;
    },
  ]);
};

module.exports = withPodfileSigningFix;
module.exports.default = withPodfileSigningFix;
