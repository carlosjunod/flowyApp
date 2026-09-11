import SwiftUI

@MainActor
final class ShareModel: ObservableObject {
    @Published var message = "Loading…"
    @Published var busy = true
    @Published var items: [SharedItem] = []
    @Published var saved = 0
    @Published var canSave = false
    private let loader = SharedItemLoader()
    private var task: Task<Void, Never>?
    var finish: (() -> Void)?
    var cancelContext: (() -> Void)?
    func load(_ input: [NSExtensionItem]) {
        task = Task {
            defer { if Task.isCancelled { loader.cleanup() } }
            do {
                guard try SharedSession.load(configuration: .current) != nil else {
                    message = "Connect Flowy first. Open Flowy once to connect your account."
                    busy = false
                    return
                }
                items = try await loader.load(input)
                try Task.checkCancellation()
                message = items.count == 1 ? items[0].preview : "\(items.count) items ready to save"
                canSave = true
            } catch { message = error.localizedDescription; loader.cleanup() }
            busy = false
        }
    }
    func save() {
        guard canSave, !busy else { return }
        busy = true
        canSave = false
        task = Task {
            defer { if Task.isCancelled { loader.cleanup() } }
            do {
                let client = FlowyAPIClient(configuration: try .current)
                while saved < items.count {
                    try Task.checkCancellation()
                    message = "Saving \(saved + 1) of \(items.count)…"
                    _ = try await client.save(item: items[saved])
                    saved += 1
                }
                message = "Saved to Flowy"
                loader.cleanup()
                try await Task.sleep(for: .seconds(1))
                finish?()
            } catch {
                message = "\(saved) of \(items.count) saved. \(error.localizedDescription) If the connection dropped, check your inbox before retrying."
                canSave = true
                busy = false
            }
        }
    }
    func cancel() {
        task?.cancel()
        // Wait for provider callbacks before deleting files they may still be copying.
        let pending = task
        Task { await pending?.value; loader.cleanup() }
        cancelContext?()
    }
}

struct ShareView: View {
    @ObservedObject var model: ShareModel
    var body: some View {
        VStack(spacing: 18) {
            Text("Save to Flowy").font(.title2.weight(.semibold))
            if model.busy { ProgressView().controlSize(.small) }
            Text(model.message).font(.callout).multilineTextAlignment(.center).textSelection(.enabled)
            if model.canSave { Button(model.saved == 0 ? "Save" : "Retry remaining") { model.save() }.buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction) }
            Button("Cancel") { model.cancel() }.keyboardShortcut(.cancelAction)
        }.padding(28).frame(width: 340, height: 230)
    }
}
