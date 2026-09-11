import SwiftUI

@main
struct FlowyApp: App {
    @StateObject private var authentication = Authentication()
    var body: some Scene {
        WindowGroup {
            ContentView(authentication: authentication).frame(width: 460).fixedSize(horizontal: true, vertical: true)
                .onAppear { authentication.reload() }
        }
        .windowResizability(.contentSize)
        .commands { CommandGroup(replacing: .newItem) {} }
        Settings {
            VStack(alignment: .leading, spacing: 16) {
                Text("Flowy for Mac").font(.headline)
                Text("Enable Flowy in System Settings → Extensions → Sharing if it does not appear in the Share menu.")
                Button("Disconnect this Mac", role: .destructive) { authentication.disconnect() }.disabled(authentication.account == nil)
            }.padding(24).frame(width: 380)
        }
    }
}
