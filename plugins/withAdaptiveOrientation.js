const { withInfoPlist } = require('@expo/config-plugins');

// Apply after Expo's orientation mod so a clean prebuild retains the iPad override.
module.exports = config => withInfoPlist(config, config => {
  config.modResults.UISupportedInterfaceOrientations = ['UIInterfaceOrientationPortrait'];
  config.modResults['UISupportedInterfaceOrientations~ipad'] = [
    'UIInterfaceOrientationPortrait',
    'UIInterfaceOrientationPortraitUpsideDown',
    'UIInterfaceOrientationLandscapeLeft',
    'UIInterfaceOrientationLandscapeRight',
  ];
  config.modResults.UIRequiresFullScreen = false;
  return config;
});
