import UIKit
import Social
import SwiftUI
import UniformTypeIdentifiers
import Security

// Flowy share extension.
// Reads iOS/macOS share sheet payload → classifies → POSTs to /api/ingest
// Token read from shared Keychain (App Group: group.app.tryflowy, key: pb_auth)

private let APP_GROUP = (Bundle.main.infoDictionary?["APP_GROUP"] as? String) ?? "group.app.tryflowy"
private let API_BASE_URL = (Bundle.main.infoDictionary?["API_BASE_URL"] as? String) ?? "http://localhost:4000"
private let AUTH_KEY = "pb_auth"
private let MAX_IMAGES = 10

private enum IngestType: String {
  case url
  case screenshot
  case youtube
  case video
  case screen_recording
  case reddit
  case instagram
}

private struct IngestPayload: Codable {
  let type: String
  let raw_url: String?
  let raw_image: String?
  let raw_images: [String]?
  let raw_video: String?
  let video_mime: String?
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
  let path = url.path.lowercased()
  if host.hasSuffix("youtube.com") || host == "youtu.be" { return .youtube }
  if host.hasSuffix("reddit.com") || host == "redd.it" { return .reddit }
  if host.hasSuffix("instagram.com") && (path.contains("/p/") || path.contains("/reel/") || path.contains("/tv/")) {
    return .instagram
  }
  if host.hasSuffix("tiktok.com") { return .video }
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
      extensionContext?.cancelRequest(withError: NSError(domain: "flowy.share", code: -1))
    } else {
      extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
  }

  private func process() async {
    guard let token = Keychain.readToken() else {
      await MainActor.run { state.update(.failure("Sign in on the Flowy app first")) }
      try? await Task.sleep(nanoseconds: 1_200_000_000)
      finish(cancelled: true)
      return
    }
    guard let payload = await extractPayload() else {
      await MainActor.run { state.update(.failure("Nothing to share")) }
      try? await Task.sleep(nanoseconds: 1_200_000_000)
      finish(cancelled: true)
      return
    }
    do {
      try await postIngest(payload: payload, token: token)
      await MainActor.run { state.update(.success) }
    } catch {
      await MainActor.run { state.update(.failure(error.localizedDescription)) }
    }
    try? await Task.sleep(nanoseconds: 1_200_000_000)
    finish()
  }

  private func extractPayload() async -> IngestPayload? {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return nil }

    // Pass 1: prefer a video (screen_recording) if present
    for item in items {
      guard let attachments = item.attachments else { continue }
      for provider in attachments {
        if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
          if let payload = await loadVideoPayload(provider) { return payload }
        }
      }
    }

    // Pass 2: prefer a URL/text-URL (single item)
    for item in items {
      guard let attachments = item.attachments else { continue }
      for provider in attachments {
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
          if let url = await loadURL(provider) {
            return IngestPayload(
              type: classify(url: url).rawValue,
              raw_url: url.absoluteString,
              raw_image: nil,
              raw_images: nil,
              raw_video: nil,
              video_mime: nil
            )
          }
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
          if let text = await loadText(provider),
             let url = URL(string: text), url.scheme != nil {
            return IngestPayload(
              type: classify(url: url).rawValue,
              raw_url: url.absoluteString,
              raw_image: nil,
              raw_images: nil,
              raw_video: nil,
              video_mime: nil
            )
          }
        }
      }
    }

    // Pass 3: collect all images across all items
    var images: [String] = []
    for item in items {
      guard let attachments = item.attachments else { continue }
      for provider in attachments where images.count < MAX_IMAGES {
        if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
          if let b64 = await loadImageBase64(provider) {
            images.append(b64)
          }
        }
      }
    }

    if images.count > 1 {
      return IngestPayload(
        type: IngestType.screenshot.rawValue,
        raw_url: nil,
        raw_image: nil,
        raw_images: images,
        raw_video: nil,
        video_mime: nil
      )
    }
    if let single = images.first {
      return IngestPayload(
        type: IngestType.screenshot.rawValue,
        raw_url: nil,
        raw_image: single,
        raw_images: nil,
        raw_video: nil,
        video_mime: nil
      )
    }

    return nil
  }

  // MARK: - Loaders

  private func loadURL(_ provider: NSItemProvider) async -> URL? {
    if let obj = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) {
      if let url = obj as? URL { return url }
    }
    return nil
  }

  private func loadText(_ provider: NSItemProvider) async -> String? {
    if let obj = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) {
      return obj as? String
    }
    return nil
  }

  private func loadImageBase64(_ provider: NSItemProvider) async -> String? {
    if let obj = try? await provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) {
      if let image = coerceImage(obj),
         let data = image.jpegData(compressionQuality: 0.85) {
        return data.base64EncodedString()
      }
    }
    return nil
  }

  private func loadVideoPayload(_ provider: NSItemProvider) async -> IngestPayload? {
    guard let obj = try? await provider.loadItem(forTypeIdentifier: UTType.movie.identifier, options: nil) else {
      return nil
    }
    var data: Data?
    var mime = "video/mp4"
    if let url = obj as? URL {
      data = try? Data(contentsOf: url)
      let ext = url.pathExtension.lowercased()
      if ext == "mov" { mime = "video/quicktime" }
      if ext == "m4v" { mime = "video/x-m4v" }
    } else if let raw = obj as? Data {
      data = raw
    }
    guard let bytes = data else { return nil }
    return IngestPayload(
      type: IngestType.screen_recording.rawValue,
      raw_url: nil,
      raw_image: nil,
      raw_images: nil,
      raw_video: bytes.base64EncodedString(),
      video_mime: mime
    )
  }

  private func coerceImage(_ obj: NSSecureCoding) -> UIImage? {
    if let image = obj as? UIImage { return image }
    if let url = obj as? URL, let data = try? Data(contentsOf: url) { return UIImage(data: data) }
    if let data = obj as? Data { return UIImage(data: data) }
    return nil
  }

  private func postIngest(payload: IngestPayload, token: String) async throws {
    guard let url = URL(string: "\(API_BASE_URL)/api/ingest") else {
      throw NSError(domain: "flowy.share", code: -2, userInfo: [NSLocalizedDescriptionKey: "Bad API URL"])
    }
    let timeout: TimeInterval = (payload.raw_video != nil) ? 120 : 60
    var req = URLRequest(url: url, timeoutInterval: timeout)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

    let encoder = JSONEncoder()
    encoder.outputFormatting = []
    req.httpBody = try encoder.encode(payload)

    let (data, response) = try await URLSession.shared.data(for: req)
    guard let http = response as? HTTPURLResponse else {
      throw NSError(domain: "flowy.share", code: -3, userInfo: [NSLocalizedDescriptionKey: "No response"])
    }
    if !(200...299).contains(http.statusCode) {
      let body = String(data: data, encoding: .utf8) ?? "\(http.statusCode)"
      throw NSError(domain: "flowy.share", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: body])
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
          Text("Sending to Flowy…").font(.headline)
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
