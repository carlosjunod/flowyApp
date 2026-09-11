import AppKit
import SwiftUI

@objc(ShareViewController)
final class ShareViewController: NSViewController {
    private let model = ShareModel()
    override func loadView() {
        view = NSHostingView(rootView: ShareView(model: model))
        preferredContentSize = NSSize(width: 396, height: 286)
    }
    override func viewDidLoad() {
        super.viewDidLoad()
        model.finish = { [weak self] in self?.extensionContext?.completeRequest(returningItems: nil) }
        model.cancelContext = { [weak self] in
            self?.extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError))
        }
        model.load(extensionContext?.inputItems as? [NSExtensionItem] ?? [])
    }
}
