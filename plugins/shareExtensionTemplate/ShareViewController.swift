import UIKit
import Social
import SwiftUI
import UniformTypeIdentifiers
import Security

// Tryflowy share extension.
// Reads iOS/macOS share sheet payload → classifies → POSTs to /api/ingest
// Token read from shared Keychain (App Group: group.app.tryflowy, key: pb_auth)

private let APP_GROUP = (Bundle.main.infoDictionary?["APP_GROUP"] as? String) ?? "group.app.tryflowy"
private let API_BASE_URL = (Bundle.main.infoDictionary?["API_BASE_URL"] as? String) ?? "http://localhost:4000"
private let AUTH_KEY = "pb_auth"

private enum IngestType: String {
  case url
  case screenshot
  case youtube
  case video
}

private struct IngestPayload: Codable {
  let type: String
  let raw_url: String?
  let raw_image: String?
}

// MARK: - Keychain

private enum Keychain {
  static func readToken() -> String? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: APP_GROUP,
      kSecAttrAccount as String: AUTH_KEY,
      kSecAttrAccessGroup as String: APP_GROUP,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess,
          let data = item as? Data,
          let raw = String(data: data, encoding: .utf8) else { return nil }

    // PocketBase AsyncAuthStore serializes as JSON { "token": "...", "model": {...} }
    if let jsonData = raw.data(using: .utf8),
       let obj = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
       let token = obj["token"] as? String {
      return token
    }
    return raw
  }
}

// MARK: - Classification

private func classify(url: URL) -> IngestType {
  let host = (url.host ?? "").lowercased()
  if host.hasSuffix("youtube.com") || host == "youtu.be" { return .youtube }
  if host.hasSuffix("tiktok.com") || host.hasSuffix("instagram.com") { return .video }
  return .url
}

// MARK: - ViewController

final class ShareViewController: UIViewController {
  private var hosting: UIHostingController<StatusView>?
  private let state = StatusState()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear

    let controller = UIHostingController(rootView: StatusView(state: state, onDismiss: { [weak self] in self?.finish() }))
    controller.view.backgroundColor = .clear
    addChild(controller)
    controller.view.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(controller.view)
    NSLayoutConstraint.activate([
      controller.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      controller.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      controller.view.topAnchor.constraint(equalTo: view.topAnchor),
      controller.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
    controller.didMove(toParent: self)
    hosting = controller
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    Task { await process() }
  }

  private func finish(cancelled: Bool = false) {
    if cancelled {
      extensionContext?.cancelRequest(withError: NSError(domain: "tryflowy.share", code: -1))
    } else {
      extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
  }

  private func process() async {
    guard let token = Keychain.readToken() else {
      await MainActor.run { state.update(.failure("Sign in on the Tryflowy app first")) }
      await Task.sleep(1_200_000_000)
      finish(cancelled: true)
      return
    }
    guard let payload = await extractPayload() else {
      await MainActor.run { state.update(.failure("Nothing to share")) }
      await Task.sleep(1_200_000_000)
      finish(cancelled: true)
      return
    }
    do {
      try await postIngest(payload: payload, token: token)
      await MainActor.run { state.update(.success) }
    } catch {
      await MainActor.run { state.update(.failure(error.localizedDescription)) }
    }
    await Task.sleep(1_200_000_000)
    finish()
  }

  private func extractPayload() async -> IngestPayload? {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return nil }
    for item in items {
      guard let attachments = item.attachments else { continue }
      for provider in attachments {
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
          if let obj = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil),
             let url = obj as? URL {
            return IngestPayload(type: classify(url: url).rawValue, raw_url: url.absoluteString, raw_image: nil)
          }
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
          if let obj = try? await provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) {
            let image = coerceImage(obj)
            if let data = image?.jpegData(compressionQuality: 0.85) {
              return IngestPayload(
                type: IngestType.screenshot.rawValue,
                raw_url: nil,
                raw_image: data.base64EncodedString()
              )
            }
          }
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
          if let obj = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil),
             let text = obj as? String,
             let url = URL(string: text), url.scheme != nil {
            return IngestPayload(type: classify(url: url).rawValue, raw_url: url.absoluteString, raw_image: nil)
          }
        }
      }
    }
    return nil
  }

  private func coerceImage(_ obj: NSSecureCoding) -> UIImage? {
    if let image = obj as? UIImage { return image }
    if let url = obj as? URL, let data = try? Data(contentsOf: url) { return UIImage(data: data) }
    if let data = obj as? Data { return UIImage(data: data) }
    return nil
  }

  private func postIngest(payload: IngestPayload, token: String) async throws {
    guard let url = URL(string: "\(API_BASE_URL)/api/ingest") else {
      throw NSError(domain: "tryflowy.share", code: -2, userInfo: [NSLocalizedDescriptionKey: "Bad API URL"])
    }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.httpBody = try JSONEncoder().encode(payload)

    let (data, response) = try await URLSession.shared.data(for: req)
    guard let http = response as? HTTPURLResponse else {
      throw NSError(domain: "tryflowy.share", code: -3, userInfo: [NSLocalizedDescriptionKey: "No response"])
    }
    if !(200...299).contains(http.statusCode) {
      let body = String(data: data, encoding: .utf8) ?? "\(http.statusCode)"
      throw NSError(domain: "tryflowy.share", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: body])
    }
  }
}

// MARK: - SwiftUI status

@MainActor
private final class StatusState: ObservableObject {
  enum State { case loading, success, failure(String) }
  @Published var state: State = .loading
  func update(_ next: State) { state = next }
}

private struct StatusView: View {
  @ObservedObject var state: StatusState
  let onDismiss: () -> Void

  var body: some View {
    ZStack {
      Color.black.opacity(0.35).ignoresSafeArea().onTapGesture { onDismiss() }
      VStack(spacing: 12) {
        switch state.state {
        case .loading:
          ProgressView().controlSize(.large)
          Text("Sending to Tryflowy…").font(.headline)
        case .success:
          Image(systemName: "checkmark.circle.fill").resizable().frame(width: 44, height: 44).foregroundColor(.green)
          Text("Saved").font(.headline)
        case .failure(let message):
          Image(systemName: "xmark.octagon.fill").resizable().frame(width: 44, height: 44).foregroundColor(.red)
          Text(message).font(.subheadline).multilineTextAlignment(.center)
        }
      }
      .padding(24)
      .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
      .padding(40)
    }
  }
}
