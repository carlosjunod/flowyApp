#!/usr/bin/env python3
"""Regenerate the dependency-free, two-target macOS Xcode project."""
from pathlib import Path
import hashlib
import plistlib

root = Path(__file__).resolve().parent
objects = {}
def add(key_name, isa, **values):
    key = hashlib.sha256(key_name.encode()).hexdigest()[:24].upper()
    objects[key] = dict(isa=isa, **values)
    return key

def configs(name, values):
    ids = []
    for mode in ('Debug', 'Release'):
        settings = dict(values)
        settings.update(SWIFT_OPTIMIZATION_LEVEL='-Onone' if mode == 'Debug' else '-O')
        ids.append(add(name + mode, 'XCBuildConfiguration', name=mode, buildSettings=settings))
    return add(name+'Configs', 'XCConfigurationList', buildConfigurations=ids, defaultConfigurationIsVisible='0', defaultConfigurationName='Release')

products = []
targets = []
source_refs = {}
for path in sorted(root.glob('*/*.swift')):
    if path.parent.name == 'Tests':
        continue
    rel = str(path.relative_to(root))
    source_refs[rel] = add(rel, 'PBXFileReference', lastKnownFileType='sourcecode.swift', path=rel, sourceTree='<group>')
resources=[]
for path in sorted(root.glob('*/*.plist')) + sorted(root.glob('*/*.entitlements')):
    rel=str(path.relative_to(root))
    resources.append(add(rel,'PBXFileReference',lastKnownFileType='text.plist.xml',path=rel,sourceTree='<group>'))
for target, bundle, product_type in [('FlowyShareExtension','app.tryflowy.mac.ShareExtension','com.apple.product-type.app-extension'),('FlowyMac','app.tryflowy.mac','com.apple.product-type.application')]:
    is_app=target=='FlowyMac'
    product=add(target+'Product','PBXFileReference',explicitFileType='wrapper.application' if is_app else 'wrapper.app-extension',includeInIndex='0',path='Flowy.app' if is_app else 'FlowyShareExtension.appex',sourceTree='BUILT_PRODUCTS_DIR')
    products.append(product)
    builds=[add(target+rel,'PBXBuildFile',fileRef=ref) for rel,ref in source_refs.items() if rel.startswith(('Shared/',target+'/'))]
    phases=[add(target+'Sources','PBXSourcesBuildPhase',buildActionMask='2147483647',files=builds,runOnlyForDeploymentPostprocessing='0')]
    deps=[]
    if is_app:
        embed=add('EmbedExtension','PBXBuildFile',fileRef=products[0],settings={'ATTRIBUTES':['RemoveHeadersOnCopy']})
        phases.append(add('EmbedPhase','PBXCopyFilesBuildPhase',buildActionMask='2147483647',dstPath='',dstSubfolderSpec='13',files=[embed],name='Embed App Extensions',runOnlyForDeploymentPostprocessing='0'))
        deps=[add('Dependency','PBXTargetDependency',target=targets[0])]
    settings=dict(PRODUCT_NAME='Flowy' if is_app else target,PRODUCT_MODULE_NAME=target,PRODUCT_BUNDLE_IDENTIFIER=bundle,INFOPLIST_FILE=target+'/Info.plist',CODE_SIGN_ENTITLEMENTS=target+'/'+target+'.entitlements',CODE_SIGN_STYLE='Automatic',DEVELOPMENT_TEAM='8C72ST495F',ENABLE_HARDENED_RUNTIME='YES',SWIFT_VERSION='5.0',SWIFT_STRICT_CONCURRENCY='targeted',MACOSX_DEPLOYMENT_TARGET='13.0',SDKROOT='macosx',SUPPORTED_PLATFORMS='macosx',FLOWY_API_BASE_URL='https://tryflowy.app',FLOWY_ENVIRONMENT='production',GENERATE_INFOPLIST_FILE='NO',LD_RUNPATH_SEARCH_PATHS='$(inherited) @executable_path/../Frameworks @executable_path/../../../../Frameworks',SKIP_INSTALL='NO' if is_app else 'YES',APPLICATION_EXTENSION_API_ONLY='NO' if is_app else 'YES',COMBINE_HIDPI_IMAGES='YES')
    targets.append(add(target,'PBXNativeTarget',buildConfigurationList=configs(target,settings),buildPhases=phases,buildRules=[],dependencies=deps,name=target,productName=settings['PRODUCT_NAME'],productReference=product,productType=product_type))
product_group=add('Products','PBXGroup',children=products,name='Products',sourceTree='<group>')
main=add('Main','PBXGroup',children=list(source_refs.values())+resources+[product_group],sourceTree='<group>')
project=add('Project','PBXProject',attributes={'BuildIndependentTargetsInParallel':'YES','LastUpgradeCheck':'2630'},buildConfigurationList=configs('Project',{'CLANG_ENABLE_MODULES':'YES','CLANG_ENABLE_OBJC_ARC':'YES'}),compatibilityVersion='Xcode 14.0',developmentRegion='en',hasScannedForEncodings='0',knownRegions=['en','Base'],mainGroup=main,productRefGroup=product_group,projectDirPath='',projectRoot='',targets=targets)
folder=root/'Flowy.xcodeproj'
folder.mkdir(exist_ok=True)
(folder/'project.pbxproj').write_bytes(plistlib.dumps({'archiveVersion':'1','classes':{},'objectVersion':'56','objects':objects,'rootObject':project},sort_keys=False))
schemes=folder/'xcshareddata'/'xcschemes'
schemes.mkdir(parents=True,exist_ok=True)
(schemes/'FlowyMac.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2630" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{targets[1]}" BuildableName="Flowy.app" BlueprintName="FlowyMac" ReferencedContainer="container:Flowy.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{targets[1]}" BuildableName="Flowy.app" BlueprintName="FlowyMac" ReferencedContainer="container:Flowy.xcodeproj"/></BuildableProductRunnable></LaunchAction>
<ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>''')
