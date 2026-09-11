import SwiftUI

struct ContentView: View {
    @ObservedObject var authentication: Authentication
    @Environment(\.openURL) private var openURL
    var body: some View {
        VStack(spacing: 22) {
            Image(systemName: "square.and.arrow.down").font(.system(size: 36)).foregroundStyle(.tint).accessibilityHidden(true)
            Text("Flowy").font(.largeTitle.weight(.semibold))
            if let account = authentication.account {
                Label("Connected as \(account.email)", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                VStack(spacing: 8) {
                    Text("Share to Flowy from:").font(.headline)
                    Text("Safari · Finder · Photos · Preview · Notes").foregroundStyle(.secondary)
                }
                Text("Share extension included. Enable Flowy in macOS Sharing settings if needed.").font(.caption).foregroundStyle(.secondary)
                Button("Open Flowy") { if let config = try? APIConfiguration.current { openURL(config.baseURL) } }.buttonStyle(.borderedProminent)
                Button("Disconnect this Mac") { authentication.disconnect() }.buttonStyle(.link)
            } else {
                Text("Share anything from your Mac directly to Flowy.").foregroundStyle(.secondary)
                Button(authentication.busy ? "Connecting…" : "Connect Flowy Account") { authentication.connect() }
                    .buttonStyle(.borderedProminent).disabled(authentication.busy)
            }
            if !authentication.message.isEmpty { Text(authentication.message).font(.callout).foregroundStyle(.secondary).textSelection(.enabled) }
        }.multilineTextAlignment(.center).padding(36)
    }
}
