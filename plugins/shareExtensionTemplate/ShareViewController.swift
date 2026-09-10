import UIKit
import Social
import SwiftUI
import UniformTypeIdentifiers
import Security
import CoreText

// Flowy share extension.
// Reads iOS/macOS share sheet payload → classifies → POSTs to /api/ingest
// Token read from shared Keychain (App Group: group.app.tryflowy, key: pb_auth)

private let APP_GROUP = (Bundle.main.infoDictionary?["APP_GROUP"] as? String) ?? "group.app.tryflowy"
private let API_BASE_URL = (Bundle.main.infoDictionary?["API_BASE_URL"] as? String) ?? "http://localhost:4000"
private let PB_BASE_URL = (Bundle.main.infoDictionary?["PB_BASE_URL"] as? String) ?? "https://pb.tryflowy.app"
private let AUTH_KEY = "pb_auth"
private let MAX_IMAGES = 10
private let MAX_FILES = 10

private enum IngestType: String {
  case url
  case screenshot
  case youtube
  case video
  case screen_recording
  case reddit
  case instagram
  case pinterest
  case dribbble
  case linkedin
  case twitter
  case pdf
  case file
}

private struct ShareFile: Codable {
  let name: String
  let mime: String
  let data: String
}

private struct IngestPayload: Codable {
  let type: String
  let raw_url: String?
  let raw_image: String?
  let raw_images: [String]?
  let raw_video: String?
  let video_mime: String?
  let raw_pdf: ShareFile?
  let raw_pdfs: [ShareFile]?
  let raw_file: ShareFile?
  let raw_files: [ShareFile]?
}

// Keep authentication separate from transport failures; response bodies are
// diagnostic data, never user-facing copy.
private enum ShareRequestError: Error {
  case signInRequired
  case rejected(Int)

  static func validate(_ response: URLResponse) throws {
    guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
    if http.statusCode == 401 { throw Self.signInRequired }
    guard (200...299).contains(http.statusCode) else { throw Self.rejected(http.statusCode) }
  }
}

// MARK: - Keychain

private enum Keychain {
  static func readToken() -> String? {
    // expo-secure-store stores kSecAttrAccount/kSecAttrGeneric as Data(key.utf8),
    // not as a String. Query with the same encoding or Keychain won't match.
    // It also appends ":no-auth" (or ":auth" for biometric items) to the service
    // name so the two auth modes live in separate keychain partitions.
    let account = Data(AUTH_KEY.utf8)
    let service = "\(APP_GROUP):no-auth"
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecAttrGeneric as String: account,
      kSecAttrAccessGroup as String: APP_GROUP,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status != errSecSuccess {
      NSLog("[flowy.share] keychain lookup failed: OSStatus=%d service=%@ account=%@ accessGroup=%@",
            Int(status), APP_GROUP, AUTH_KEY, APP_GROUP)
      return nil
    }
    guard let data = item as? Data,
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
  if host.hasSuffix("pinterest.com") || host.hasSuffix("pin.it") { return .pinterest }
  if host.hasSuffix("dribbble.com") { return .dribbble }
  if host.hasSuffix("linkedin.com") || host.hasSuffix("lnkd.in") { return .linkedin }
  if host.hasSuffix("twitter.com") || host.hasSuffix("x.com") || host.hasSuffix("t.co") { return .twitter }
  return .url
}

// MARK: - ViewController

final class ShareViewController: UIViewController {
  private var hosting: UIHostingController<StatusView>?
  private let state = StatusState()
  private var processTask: Task<Void, Never>?
  private var hasStarted = false
  private var hasFinished = false
  private var savedID: String?
  private var authToken: String?

  deinit { processTask?.cancel() }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear
    UITextView.appearance().backgroundColor = .clear

    if let font = Bundle.main.url(forResource: "InstrumentSerif_400Regular", withExtension: "ttf") {
      CTFontManagerRegisterFontsForURL(font as CFURL, .process, nil)
    }
    isModalInPresentation = true
    state.onAutoDismiss = { [weak self] in self?.finish() }
    let controller = UIHostingController(rootView: StatusView(
      state: state,
      onDismiss: { [weak self] in
        guard let self else { return }
        self.finish(cancelled: self.savedID == nil)
      },
      onEdit: { [weak self] in Task { await self?.loadAnnotations() } },
      onSave: { [weak self] in Task { await self?.saveAnnotations() } }
    ))
    let touch = ShareTouchObserver(target: nil, action: nil)
    touch.onTouch = { [weak self] in self?.state.interact() }
    touch.cancelsTouchesInView = false
    touch.delaysTouchesBegan = false
    view.addGestureRecognizer(touch)
    view.addGestureRecognizer(ShareDismissPan(state: state) { [weak self] in self?.finish() })
    NotificationCenter.default.addObserver(self, selector: #selector(holdOpen), name: UIAccessibility.voiceOverStatusDidChangeNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(holdOpen), name: UIApplication.willResignActiveNotification, object: nil)
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
    guard !hasStarted else { return }
    hasStarted = true
    processTask = Task { await process() }
  }

  @objc private func holdOpen() { state.interact() }

  override func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    state.interact()
  }

  private func finish(cancelled: Bool = false) {
    guard !hasFinished else { return }
    hasFinished = true
    state.stopCountdown()
    processTask?.cancel()
    state.beginDismissal { [weak self] in
      if cancelled {
        self?.extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError))
      } else {
        self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
      }
    }
  }

  private func process(token: String? = Keychain.readToken()) async {
    guard let token, !token.isEmpty else {
      state.update(.signInRequired)
      return
    }
    authToken = token
    guard let payload = await extractPayload() else {
      state.update(.failure("This item could not be read. Try sharing a link, photo or file."))
      return
    }
    guard !Task.isCancelled else { return }
    state.source = payload.raw_url.flatMap { URL(string: $0)?.host } ??
      payload.raw_pdf?.name ?? payload.raw_file?.name ??
      (payload.raw_images != nil ? "Your shared photos" : "Your shared item")
    do {
      savedID = try await postIngest(payload: payload, token: token)
      guard !Task.isCancelled else { return }
      state.update(.success)
      UINotificationFeedbackGenerator().notificationOccurred(.success)
      state.startCountdown()
    } catch {
      guard !Task.isCancelled else { return }
      handleIngestError(error)
    }
  }

  private func handleIngestError(_ error: Error) {
    if case ShareRequestError.signInRequired = error {
      state.update(.signInRequired)
    } else {
      state.update(.failure("We couldn’t confirm the save. Check your connection and your Flowy inbox before sharing again."))
    }
  }

  private func readAnnotations(id: String, token: String) async throws -> ShareAnnotations {
    guard let url = URL(string: "\(PB_BASE_URL)/api/collections/items/records/\(id)?fields=tags,notes") else {
      throw URLError(.badURL)
    }
    var request = URLRequest(url: url, timeoutInterval: 20)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    let (data, response) = try await URLSession.shared.data(for: request)
    try ShareRequestError.validate(response)
    return try JSONDecoder().decode(ShareAnnotations.self, from: data)
  }

  private func loadAnnotations() async {
    guard let id = savedID, let token = authToken, !state.annotationsLoaded, !state.metadataBusy else { return }
    state.metadataBusy = true
    state.editorError = nil
    defer { state.metadataBusy = false }
    do {
      let existing = try await readAnnotations(id: id, token: token)
      state.tags = existing.tags ?? []
      state.notes = existing.notes ?? ""
      state.original = existing
      state.annotationsLoaded = true
    } catch ShareRequestError.signInRequired {
      state.editorError = "Your item is saved, but your session has ended. Open Flowy and sign in to add tags or a note to this item."
    } catch {
      state.editorError = "Your item is saved. We couldn’t load its details. Try again to add tags or a note."
    }
  }

  private func saveAnnotations() async {
    guard let id = savedID, let token = authToken, state.annotationsLoaded, !state.metadataBusy else { return }
    state.addTag()
    guard state.tagError == nil else { return }
    state.metadataBusy = true
    state.editorError = nil
    defer { state.metadataBusy = false }
    do {
      var patch: [String: Any] = [:]
      if state.tags != (state.original.tags ?? []) {
        // Re-read before writing: AI may have added tags while the editor was open.
        let latest = try await readAnnotations(id: id, token: token)
        let removed = Set((state.original.tags ?? []).filter { !state.tags.contains($0) }.map { $0.lowercased() })
        var seen = Set<String>()
        let merged = (state.tags + (latest.tags ?? []).filter { !removed.contains($0.lowercased()) })
          .filter { seen.insert($0.lowercased()).inserted }
        guard merged.count <= 20 else {
          state.original.tags = latest.tags
          state.tags = merged
          state.stage = .tags
          state.editorError = "Automatic tags were added. Remove any you don’t need to keep up to 20, then save again."
          return
        }
        patch["tags"] = merged
      }
      if state.notes != (state.original.notes ?? "") { patch["notes"] = state.notes }
      if !patch.isEmpty {
        guard let url = URL(string: "\(API_BASE_URL)/api/items/\(id)") else { throw URLError(.badURL) }
        var request = URLRequest(url: url, timeoutInterval: 30)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: patch)
        let (_, response) = try await URLSession.shared.data(for: request)
        try ShareRequestError.validate(response)
      }
      UINotificationFeedbackGenerator().notificationOccurred(.success)
      finish()
    } catch ShareRequestError.signInRequired {
      state.editorError = "Your item is saved, but your session has ended. These edits haven’t been saved. Open Flowy and sign in before adding them to this item."
    } catch {
      state.editorError = "Your item is saved, but these changes couldn’t be saved. Your draft is still here — try again."
    }
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
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
           !provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
          if let url = await loadURL(provider) {
            return makeURLPayload(url)
          }
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
          if let text = await loadText(provider),
             let url = URL(string: text), url.scheme != nil, url.scheme != "file" {
            return makeURLPayload(url)
          }
        }
      }
    }

    // Pass 3: collect PDFs across all items
    var pdfs: [ShareFile] = []
    for item in items {
      guard let attachments = item.attachments else { continue }
      for provider in attachments where pdfs.count < MAX_FILES {
        if provider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier) {
          if let pdf = await loadFile(provider, typeIdentifier: UTType.pdf.identifier, fallbackMime: "application/pdf") {
            pdfs.append(pdf)
          }
        }
      }
    }

    if pdfs.count > 1 {
      return IngestPayload(
        type: IngestType.pdf.rawValue,
        raw_url: nil, raw_image: nil, raw_images: nil, raw_video: nil, video_mime: nil,
        raw_pdf: nil, raw_pdfs: pdfs, raw_file: nil, raw_files: nil
      )
    }
    if let single = pdfs.first {
      return IngestPayload(
        type: IngestType.pdf.rawValue,
        raw_url: nil, raw_image: nil, raw_images: nil, raw_video: nil, video_mime: nil,
        raw_pdf: single, raw_pdfs: nil, raw_file: nil, raw_files: nil
      )
    }

    // Pass 4: collect all images across all items
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
        raw_url: nil, raw_image: nil, raw_images: images, raw_video: nil, video_mime: nil,
        raw_pdf: nil, raw_pdfs: nil, raw_file: nil, raw_files: nil
      )
    }
    if let single = images.first {
      return IngestPayload(
        type: IngestType.screenshot.rawValue,
        raw_url: nil, raw_image: single, raw_images: nil, raw_video: nil, video_mime: nil,
        raw_pdf: nil, raw_pdfs: nil, raw_file: nil, raw_files: nil
      )
    }

    // Pass 5: collect generic files (any other shared documents)
    var files: [ShareFile] = []
    for item in items {
      guard let attachments = item.attachments else { continue }
      for provider in attachments where files.count < MAX_FILES {
        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
          if let file = await loadFile(provider, typeIdentifier: UTType.fileURL.identifier, fallbackMime: "application/octet-stream") {
            files.append(file)
          }
        } else if provider.hasItemConformingToTypeIdentifier(UTType.data.identifier) {
          if let file = await loadFile(provider, typeIdentifier: UTType.data.identifier, fallbackMime: "application/octet-stream") {
            files.append(file)
          }
        }
      }
    }

    if files.count > 1 {
      return IngestPayload(
        type: IngestType.file.rawValue,
        raw_url: nil, raw_image: nil, raw_images: nil, raw_video: nil, video_mime: nil,
        raw_pdf: nil, raw_pdfs: nil, raw_file: nil, raw_files: files
      )
    }
    if let single = files.first {
      return IngestPayload(
        type: IngestType.file.rawValue,
        raw_url: nil, raw_image: nil, raw_images: nil, raw_video: nil, video_mime: nil,
        raw_pdf: nil, raw_pdfs: nil, raw_file: single, raw_files: nil
      )
    }

    return nil
  }

  private func makeURLPayload(_ url: URL) -> IngestPayload {
    IngestPayload(
      type: classify(url: url).rawValue,
      raw_url: url.absoluteString,
      raw_image: nil, raw_images: nil, raw_video: nil, video_mime: nil,
      raw_pdf: nil, raw_pdfs: nil, raw_file: nil, raw_files: nil
    )
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

  private func loadFile(_ provider: NSItemProvider, typeIdentifier: String, fallbackMime: String) async -> ShareFile? {
    guard let obj = try? await provider.loadItem(forTypeIdentifier: typeIdentifier, options: nil) else {
      return nil
    }
    var data: Data?
    var name = provider.suggestedName ?? "file"
    var mime = fallbackMime
    if let url = obj as? URL {
      data = try? Data(contentsOf: url)
      if !url.lastPathComponent.isEmpty { name = url.lastPathComponent }
      if let utType = UTType(filenameExtension: url.pathExtension),
         let inferred = utType.preferredMIMEType {
        mime = inferred
      }
    } else if let raw = obj as? Data {
      data = raw
    } else if let str = obj as? String {
      data = str.data(using: .utf8)
    }
    guard let bytes = data else { return nil }
    return ShareFile(name: name, mime: mime, data: bytes.base64EncodedString())
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
      video_mime: mime,
      raw_pdf: nil, raw_pdfs: nil, raw_file: nil, raw_files: nil
    )
  }

  private func coerceImage(_ obj: NSSecureCoding) -> UIImage? {
    if let image = obj as? UIImage { return image }
    if let url = obj as? URL, let data = try? Data(contentsOf: url) { return UIImage(data: data) }
    if let data = obj as? Data { return UIImage(data: data) }
    return nil
  }

  private func postIngest(payload: IngestPayload, token: String) async throws -> String {
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
    try ShareRequestError.validate(response)
    struct Receipt: Decodable {
      struct Item: Decodable { let id: String }
      let data: Item
    }
    let receipt = try JSONDecoder().decode(Receipt.self, from: data)
    guard !receipt.data.id.isEmpty,
          receipt.data.id.allSatisfy({ $0.isLetter || $0.isNumber }) else {
      throw URLError(.cannotParseResponse)
    }
    return receipt.data.id
  }
}

// MARK: - Interaction and presentation

// Observes touch-down without competing with buttons, scrolling or text selection.
private final class ShareTouchObserver: UIGestureRecognizer {
  var onTouch: (() -> Void)?
  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
    onTouch?()
    state = .failed
  }
}

// Recognize a deliberate downward pull only after the item has been saved.
// UIKit arbitrates with nested scroll views before cancelling their touches.
@MainActor
private final class ShareDismissPan: UIPanGestureRecognizer, UIGestureRecognizerDelegate {
  private let status: StatusState
  private let onDismiss: () -> Void

  init(state: StatusState, onDismiss: @escaping () -> Void) {
    status = state
    self.onDismiss = onDismiss
    super.init(target: nil, action: nil)
    addTarget(self, action: #selector(handlePan))
    delegate = self
    maximumNumberOfTouches = 1
  }

  func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard status.canSwipeDismiss else { return false }
    let speed = velocity(in: view)
    guard speed.y > abs(speed.x) else { return false }
    var touched = view?.hitTest(location(in: view), with: nil)
    while let current = touched, current !== view {
      if current is UITextView || current is UITextField || current is UIControl { return false }
      if let scroll = current as? UIScrollView,
         scroll.contentOffset.y > -scroll.adjustedContentInset.top + 1 { return false }
      touched = current.superview
    }
    return true
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                         shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer) -> Bool {
    // A downward pull at the top belongs to dismissal. Else shouldBegin rejects
    // this recognizer and the scroll view continues normally.
    guard let scroll = otherGestureRecognizer.view as? UIScrollView else { return false }
    return otherGestureRecognizer === scroll.panGestureRecognizer
  }

  static func shouldDismiss(distance: CGFloat, velocity: CGFloat) -> Bool {
    distance >= 96 || (distance >= 28 && velocity >= 700)
  }

  @objc private func handlePan() {
    switch state {
    case .began, .changed:
      status.interact()
      status.dismissDrag = max(0, translation(in: view).y)
    case .ended:
      if Self.shouldDismiss(distance: max(0, translation(in: view).y), velocity: velocity(in: view).y) {
        status.swipeDismissal = true
        onDismiss()
      } else { status.resetDismissDrag() }
    case .cancelled, .failed:
      status.resetDismissDrag()
    default: break
    }
  }
}

private struct ShareAnnotations: Decodable {
  var tags: [String]? = []
  var notes: String? = ""
}

private enum ShareSuccessCopy {
  static let titles = [
    "A little find.\nA lasting idea.",
    "Found it.\nKept it.",
    "A spark today.\nAn idea tomorrow.",
    "A good thought.\nRoom to grow.",
    "Out of the scroll.\nInto your flow.",
    "One for\nfuture you.",
    "A little curiosity.\nSafely tucked away.",
    "Good things\nare worth keeping.",
    "Less to remember.\nMore to discover.",
    "Keep the spark.\nSee where it goes.",
  ]

  static func choose(using defaults: UserDefaults = .standard) -> String {
    let key = "flowy.share.lastSuccessPhrase"
    let previous = defaults.object(forKey: key) as? Int
    let candidates = titles.indices.filter { $0 != previous }
    let index = candidates.randomElement() ?? titles.startIndex
    defaults.set(index, forKey: key)
    return titles[index]
  }
}

@MainActor
private final class StatusState: ObservableObject {
  enum State: Equatable { case loading, success, signInRequired, failure(String) }
  enum Stage: Int { case confirmation, tags, notes }
  // Choose once per share, never during redraws, countdown ticks or editing.
  let successTitle = ShareSuccessCopy.choose()
  @Published var state: State = .loading
  @Published var stage: Stage = .confirmation
  @Published var hasInteracted = false
  @Published var isDismissing = false
  @Published var dismissDrag: CGFloat = 0
  var swipeDismissal = false
  @Published var remaining: Double = 1
  @Published var countingDown = false
  @Published var source = "Your shared item"
  @Published var tags: [String] = []
  @Published var tagDraft = ""
  @Published var notes = ""
  @Published var metadataBusy = false
  @Published var annotationsLoaded = false
  @Published var editorError: String?
  @Published var tagError: String?
  var original = ShareAnnotations()
  var onAutoDismiss: (() -> Void)?
  private var countdown: Task<Void, Never>?

  var canSwipeDismiss: Bool {
    state == .success && stage == .confirmation && !metadataBusy && !isDismissing
  }

  func resetDismissDrag() {
    withAnimation(UIAccessibility.isReduceMotionEnabled ? nil : .spring(response: 0.28, dampingFraction: 0.86)) {
      dismissDrag = 0
    }
  }

  func update(_ next: State) { stopCountdown(); state = next }

  func interact() {
    hasInteracted = true
    stopCountdown()
  }

  func stopCountdown() {
    countdown?.cancel()
    countdown = nil
    countingDown = false
  }

  func beginDismissal(_ completion: @escaping () -> Void) {
    guard !isDismissing else { return }
    stopCountdown()
    isDismissing = true
    Task {
      try? await Task.sleep(nanoseconds: 180_000_000)
      completion()
    }
  }

  func startCountdown() {
    guard state == .success, !isDismissing else { return }
    stopCountdown()
    remaining = 1
    guard !hasInteracted, !UIAccessibility.isVoiceOverRunning else { interact(); return }
    countingDown = true
    let start = ProcessInfo.processInfo.systemUptime
    countdown = Task { [weak self] in
      while !Task.isCancelled {
        do { try await Task.sleep(nanoseconds: 30_000_000) } catch { return }
        guard let self, !self.hasInteracted, self.state == .success else { return }
        self.remaining = max(0, 1 - (ProcessInfo.processInfo.systemUptime - start) / 5)
        if self.remaining == 0 {
          self.countingDown = false
          self.onAutoDismiss?()
          return
        }
      }
    }
  }

  func addTag() {
    let tag = tagDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      .trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    tagError = nil
    guard !tag.isEmpty else { tagDraft = ""; return }
    guard tag.count <= 64 else { tagError = "Keep each tag under 65 characters."; return }
    guard !tags.contains(where: { $0.caseInsensitiveCompare(tag) == .orderedSame }) else { tagDraft = ""; return }
    guard tags.count < 20 else { tagError = "You can add up to 20 tags."; return }
    tags.append(tag)
    tagDraft = ""
    UISelectionFeedbackGenerator().selectionChanged()
  }
}

private struct SharePressStyle: ButtonStyle {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .opacity(configuration.isPressed ? 0.76 : 1)
      .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
      .animation(.easeOut(duration: 0.14), value: configuration.isPressed)
  }
}

private struct StatusView: View {
  @ObservedObject var state: StatusState
  let onDismiss: () -> Void
  let onEdit: () -> Void
  let onSave: () -> Void
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var appeared = false
  @State private var confirmingDiscard = false
  @FocusState private var focusedField: Field?
  private enum Field: Hashable { case tag, note }

  private var dark: Bool { colorScheme == .dark }
  private var paper: Color { Color(hex: dark ? 0x1A1C20 : 0xF8F4EA) }
  private var ink: Color { Color(hex: dark ? 0xEEEAE0 : 0x1C1815) }
  private var muted: Color { Color(hex: dark ? 0x9DA1AA : 0x6B6258) }
  private var accent: Color { Color(hex: dark ? 0xEB7C4C : 0xA93E1E) }
  private var border: Color { Color(hex: dark ? 0x3A3D44 : 0xDFD5C2) }
  private var surface: Color { Color(hex: dark ? 0x272A31 : 0xFFFCF5) }
  private var transition: AnyTransition {
    reduceMotion ? .opacity : .asymmetric(
      insertion: .opacity.combined(with: .offset(y: 8)).combined(with: .scale(scale: 0.99)),
      removal: .opacity.combined(with: .offset(y: -4))
    )
  }

  var body: some View {
    ZStack {
      paper.ignoresSafeArea()
      ShareAmbientBackground(accent: accent, paper: paper, dark: dark)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
      VStack(spacing: 0) {
        Capsule().fill(muted.opacity(0.35))
          .frame(width: 32, height: 4).padding(.top, 8)
          .accessibilityHidden(true)
        progressTrack
        header
        if state.stage == .confirmation {
          confirmation.transition(transition)
        } else {
          editor.id(state.stage).transition(transition)
        }
      }
      .frame(maxWidth: 560)
      .padding(.horizontal, 28)
      .opacity(appeared ? 1 : 0)
      .offset(y: appeared || reduceMotion ? 0 : 6)
    }
    .opacity(state.isDismissing ? 0 : 1)
    .scaleEffect(state.isDismissing && !reduceMotion ? 0.985 : 1)
    .allowsHitTesting(!state.isDismissing)
    .foregroundColor(ink)
    .tint(accent)
    .buttonStyle(SharePressStyle())
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .offset(y: reduceMotion ? 0 : state.isDismissing
      ? (state.swipeDismissal ? UIScreen.main.bounds.height : 4)
      : state.dismissDrag)
    .animation(.easeOut(duration: 0.18), value: state.isDismissing)
    .onAppear {
      withAnimation(.easeOut(duration: reduceMotion ? 0.18 : 0.28)) { appeared = true }
    }
    .alert("Discard your changes?", isPresented: $confirmingDiscard) {
      Button("Discard changes", role: .destructive, action: onDismiss)
      Button("Keep editing", role: .cancel) {}
    } message: {
      Text("Your item is already saved. Only the tags and note you edited here will be discarded.")
    }
    .onDisappear { state.stopCountdown() }
    .onChange(of: focusedField) { _ in state.interact() }
    .onChange(of: state.notes) { text in
      state.interact()
      if text.count > 100000 { state.notes = String(text.prefix(100000)) }
    }
    .onChange(of: state.tagDraft) { _ in state.interact() }
    .animation(reduceMotion ? nil : .easeOut(duration: 0.22), value: state.stage)
    .animation(reduceMotion ? nil : .easeOut(duration: 0.22), value: state.state)
  }

  private var progressTrack: some View {
    GeometryReader { geometry in
      Capsule().fill(border.opacity(0.6))
        .overlay(alignment: .leading) {
          Capsule().fill(accent.opacity(0.75))
            .frame(width: geometry.size.width)
            .scaleEffect(x: state.remaining, y: 1, anchor: .leading)
            .animation(reduceMotion ? nil : .linear(duration: 0.04), value: state.remaining)
        }
    }
    .frame(height: 2)
    .opacity(state.countingDown ? 1 : 0)
    .padding(.top, 12)
    .accessibilityHidden(true)
  }

  private var header: some View {
    HStack {
      Text("flowy").font(.custom("InstrumentSerif-Regular", size: 32, relativeTo: .title))
      Spacer()
      if state.stage != .confirmation {
        Text("SAVED")
          .font(.system(size: 10, weight: .medium)).tracking(1.4).foregroundColor(muted)
      }
      Button {
        state.interact()
        let dirty = state.tags != (state.original.tags ?? []) ||
          state.notes != (state.original.notes ?? "") ||
          !state.tagDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        if state.stage != .confirmation && dirty {
          focusedField = nil
          confirmingDiscard = true
        }
        else { onDismiss() }
      } label: {
        Image(systemName: "xmark").font(.system(size: 14, weight: .medium))
          .foregroundColor(muted).frame(width: 44, height: 44)
          .background(border.opacity(0.35), in: Circle())
      }
      .accessibilityLabel("Close share screen")
      .disabled(state.metadataBusy)
    }
    .padding(.top, 18).padding(.bottom, 12)
  }

  private var confirmation: some View {
    GeometryReader { geometry in
      ScrollView {
        VStack(spacing: 0) {
          Spacer(minLength: 32)
          emblem.padding(.bottom, 32)
          Group {
            switch state.state {
            case .loading:
              eyebrow("A LITTLE SPACE FOR YOUR IDEAS")
              title("Keeping this\nfor you.")
              Text("Sending to your Flowy inbox…").foregroundColor(muted).padding(.top, 16)
            case .success:
              eyebrow("SAVED TO FLOWY")
              title(state.successTitle)
              Text("Safe in your inbox. Back to your flow.")
                .foregroundColor(muted).padding(.top, 16)
              Label(state.source, systemImage: "bookmark")
                .font(.system(size: 12)).foregroundColor(muted)
                .lineLimit(1).padding(.horizontal, 16).padding(.vertical, 10)
                .background(surface.opacity(0.7), in: Capsule())
                .overlay(Capsule().stroke(border.opacity(0.7), lineWidth: 1))
                .padding(.top, 24)
            case .signInRequired:
              eyebrow("A LITTLE SPACE FOR YOUR IDEAS")
              title("Sign in to\nkeep this.")
              Text("Open the Flowy app and sign in.\nThen come back and share this again.")
                .font(.system(size: 15)).lineSpacing(5)
                .foregroundColor(muted).padding(.top, 18)
            case .failure(let message):
              eyebrow("LET’S KEEP THAT IDEA")
              title("A small\ninterruption.")
              Text(message).foregroundColor(muted).padding(.top, 16)
            }
          }
          .multilineTextAlignment(.center)
          Spacer(minLength: 44)
          if state.state == .success {
            Button {
              state.interact()
              state.stage = .tags
              onEdit()
            } label: {
              Label("Add tags or a note", systemImage: "plus")
                .font(.system(size: 16, weight: .medium))
                .frame(maxWidth: .infinity).padding(.vertical, 18)
                .background(surface.opacity(0.6), in: Capsule())
                .overlay(Capsule().stroke(border, lineWidth: 1))
            }
            Text(state.hasInteracted ? "Take your time. Close whenever you’re ready." : "Closes in a moment · tap anywhere to stay")
              .font(.system(size: 12)).foregroundColor(muted)
              .multilineTextAlignment(.center).padding(.top, 18)
          } else if state.state == .signInRequired {
            Button(action: onDismiss) {
              Text("Got it")
                .font(.system(size: 16, weight: .medium))
                .frame(maxWidth: .infinity).padding(.vertical, 18)
                .background(ink, in: Capsule()).foregroundColor(paper)
            }
            Text("This item hasn’t been saved yet.")
              .font(.system(size: 12)).foregroundColor(muted)
              .multilineTextAlignment(.center).padding(.top, 18)
          } else if case .failure = state.state {
            Button("Close", action: onDismiss).frame(minHeight: 48)
          }
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: max(0, geometry.size.height - 34))
        .padding(.bottom, 34)
      }
    }
  }

  private var emblem: some View {
    ZStack {
      Circle().stroke(accent.opacity(0.09), lineWidth: 1).frame(width: 114, height: 114)
      Circle().stroke(accent.opacity(0.18), lineWidth: 1).frame(width: 88, height: 88)
      if state.state == .loading {
        ProgressView().tint(accent)
      } else if state.state == .success {
        ShareSuccessMark(color: accent).transition(.opacity)
      } else if state.state == .signInRequired {
        Image(systemName: "person.crop.circle")
          .font(.system(size: 30, weight: .ultraLight)).foregroundColor(accent)
          .transition(.opacity)
      } else {
        Image(systemName: "exclamationmark")
          .font(.system(size: 26, weight: .light)).foregroundColor(accent)
          .transition(.opacity)
      }
      ShareOrbit(color: accent)
    }
    .frame(height: 116)
    .accessibilityHidden(true)
  }

  private func eyebrow(_ text: String) -> some View {
    Text(text).font(.system(size: 10, weight: .medium)).tracking(2)
      .foregroundColor(accent).padding(.bottom, 14)
  }

  private func title(_ text: String) -> some View {
    Text(text).font(.custom("InstrumentSerif-Regular", size: 48, relativeTo: .largeTitle))
      .lineSpacing(-2).fixedSize(horizontal: false, vertical: true)
      .accessibilityAddTraits(.isHeader)
  }

  private var editor: some View {
    VStack(spacing: 0) {
      ScrollView {
        VStack(alignment: .leading, spacing: 22) {
          HStack(spacing: 8) {
            stageButton("1  Tags", stage: .tags)
            Image(systemName: "arrow.right").font(.system(size: 10)).foregroundColor(muted)
            stageButton("2  Note", stage: .notes)
            Spacer()
          }.padding(.top, 22)
          VStack(alignment: .leading, spacing: 8) {
            Text(state.stage == .tags ? "Make it yours." : "Keep the thought.")
              .font(.custom("InstrumentSerif-Regular", size: 38, relativeTo: .largeTitle))
              .accessibilityAddTraits(.isHeader)
            Text(state.stage == .tags ? "A few words to find it again." : "What caught your eye? Leave a little context for later.")
              .font(.system(size: 14)).foregroundColor(muted)
          }
          if state.metadataBusy && !state.annotationsLoaded {
            ProgressView("Loading your details…").padding(.vertical, 24)
          } else if state.annotationsLoaded {
            if state.stage == .tags { tagsEditor } else { notesEditor }
          }
          if let error = state.editorError {
            Text(error).font(.system(size: 13)).foregroundColor(accent)
              .accessibilityLabel("Error. " + error)
            if !state.annotationsLoaded {
              Button("Try again", action: onEdit).frame(minHeight: 44)
            }
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 24)
      }
      .disabled(state.metadataBusy)
      editorActions
    }
  }

  private func stageButton(_ label: String, stage: StatusState.Stage) -> some View {
    Button {
      state.interact()
      state.addTag()
      guard state.tagError == nil else { return }
      focusedField = nil
      state.stage = stage
    } label: {
      Text(label).font(.system(size: 12, weight: .medium))
        .foregroundColor(state.stage == stage ? accent : muted)
        .padding(.horizontal, 14).frame(minHeight: 44)
        .background(state.stage == stage ? accent.opacity(0.08) : Color.clear, in: Capsule())
    }.accessibilityAddTraits(state.stage == stage ? .isSelected : [])
  }

  private var tagsEditor: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack(spacing: 10) {
        Text("#").foregroundColor(accent)
        TextField("Add a tag", text: $state.tagDraft)
          .focused($focusedField, equals: .tag)
          .submitLabel(.done).onSubmit { state.addTag() }
          .autocapitalization(.none).disableAutocorrection(true)
          .accessibilityLabel("New tag")
        Button { state.addTag() } label: {
          Image(systemName: "plus").frame(width: 44, height: 44)
        }.accessibilityLabel("Add tag")
      }
      .padding(.leading, 16).padding(.trailing, 4).padding(.vertical, 4)
      .background(surface, in: RoundedRectangle(cornerRadius: 16))
      .overlay(RoundedRectangle(cornerRadius: 16).stroke(border, lineWidth: 1))
      if let error = state.tagError { Text(error).font(.system(size: 12)).foregroundColor(accent) }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 125), spacing: 8)], alignment: .leading, spacing: 8) {
        ForEach(Array(state.tags.enumerated()), id: \.offset) { index, tag in
          Button {
            state.tags.remove(at: index)
            state.tagError = nil
          } label: {
            HStack(spacing: 8) {
              Text("# " + tag).lineLimit(2).frame(maxWidth: .infinity, alignment: .leading)
              Image(systemName: "xmark").font(.system(size: 9, weight: .semibold))
            }
            .font(.system(size: 13)).foregroundColor(accent)
            .padding(.horizontal, 13).frame(minHeight: 44)
            .background(accent.opacity(0.07), in: RoundedRectangle(cornerRadius: 13))
          }
          .accessibilityLabel("Remove tag " + tag)
          .transition(reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.96)))
        }
      }
      .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: state.tags)
      Text(state.tags.isEmpty ? "Your tags are optional. Flowy also organizes this for you." : "Tap a tag to remove it. \(state.tags.count)/20")
        .font(.system(size: 12)).foregroundColor(muted)
    }
  }

  private var notesEditor: some View {
    VStack(alignment: .leading, spacing: 12) {
      ZStack(alignment: .topLeading) {
        if state.notes.isEmpty {
          Text("I saved this because…").foregroundColor(muted.opacity(0.7))
            .padding(.horizontal, 5).padding(.top, 8).allowsHitTesting(false)
        }
        noteInput
          .focused($focusedField, equals: .note)
          .frame(minHeight: 160, maxHeight: 240)
          .accessibilityLabel("Note for this item")
      }
      .font(.system(size: 16)).padding(14)
      .background(surface, in: RoundedRectangle(cornerRadius: 18))
      .overlay(RoundedRectangle(cornerRadius: 18).stroke(border, lineWidth: 1))
      Label("Just for you. Saved with this item.", systemImage: "lock")
        .font(.system(size: 12)).foregroundColor(muted)
    }
  }

  @ViewBuilder private var noteInput: some View {
    if #available(iOS 16.0, *) {
      TextEditor(text: $state.notes).scrollContentBackground(.hidden)
    } else {
      TextEditor(text: $state.notes)
    }
  }

  private var editorActions: some View {
    VStack(spacing: 8) {
      if state.stage == .tags {
        Button {
          state.addTag()
          guard state.tagError == nil else { return }
          focusedField = nil
          state.stage = .notes
        } label: {
          HStack {
            Text("Next · Add a note")
            Image(systemName: "arrow.right")
          }.frame(maxWidth: .infinity).padding(.vertical, 17)
        }
        .background(ink, in: Capsule()).foregroundColor(paper)
        .disabled(!state.annotationsLoaded || state.metadataBusy)
      }
      Button {
        state.interact()
        focusedField = nil
        onSave()
      } label: {
        HStack(spacing: 10) {
          if state.metadataBusy && state.annotationsLoaded { ProgressView().tint(state.stage == .notes ? paper : muted) }
          Text(state.metadataBusy && state.annotationsLoaded ? "Saving…" : "Save & close")
        }
        .frame(maxWidth: .infinity).padding(.vertical, 17)
      }
      .background(state.stage == .notes ? ink : Color.clear, in: Capsule())
      .foregroundColor(state.stage == .notes ? paper : muted)
      .disabled(!state.annotationsLoaded || state.metadataBusy)
      if !state.annotationsLoaded && !state.metadataBusy {
        Button("Close", action: onDismiss).frame(minHeight: 44)
      }
    }
    .font(.system(size: 15, weight: .medium))
    .padding(.top, 10).padding(.bottom, 20)
  }
}

private struct ShareSuccessMark: View {
  let color: Color
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var entered = false

  var body: some View {
    Image(systemName: "checkmark")
      .font(.system(size: 26, weight: .light))
      .foregroundColor(color)
      .opacity(entered ? 1 : 0)
      .scaleEffect(entered || reduceMotion ? 1 : 1.05)
      .rotationEffect(.degrees(entered || reduceMotion ? 0 : -8))
      .onAppear {
        withAnimation(.easeOut(duration: reduceMotion ? 0.18 : 0.32)) { entered = true }
      }
  }
}

// These decorative loops own their state so the countdown and editor never
// restart them. Only transforms animate; the radial gradient is painted once.
private struct ShareOrbit: View {
  let color: Color
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var orbiting = false

  var body: some View {
    ZStack {
      Circle().fill(color.opacity(0.7))
        .frame(width: 5, height: 5).offset(y: -57)
    }
    .frame(width: 114, height: 114)
    .rotationEffect(.degrees(-32 + (orbiting && !reduceMotion ? 360 : 0)))
    .animation(reduceMotion ? nil : .linear(duration: 18).repeatForever(autoreverses: false), value: orbiting)
    .onAppear { orbiting = !reduceMotion }
    .onChange(of: reduceMotion) { orbiting = !$0 }
    .accessibilityHidden(true)
  }
}

private struct ShareAmbientBackground: View {
  let accent: Color
  let paper: Color
  let dark: Bool
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var drifting = false

  var body: some View {
    GeometryReader { geometry in
      Circle()
        .fill(RadialGradient(
          colors: [accent.opacity(dark ? 0.14 : 0.11), paper.opacity(0)],
          center: .center, startRadius: 0, endRadius: 210
        ))
        .frame(width: 440, height: 440)
        .scaleEffect(reduceMotion ? 1 : (drifting ? 1.06 : 0.98))
        .offset(x: reduceMotion ? 0 : (drifting ? 18 : -18),
                y: reduceMotion ? 0 : (drifting ? -28 : 20))
        .position(x: geometry.size.width * 0.8, y: geometry.size.height * 0.48)
        .animation(reduceMotion ? nil : .easeInOut(duration: 12).repeatForever(autoreverses: true), value: drifting)
    }
    .onAppear { drifting = !reduceMotion }
    .onChange(of: reduceMotion) { drifting = !$0 }
  }
}

private extension Color {
  init(hex: UInt32) {
    self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255,
              green: Double((hex >> 8) & 0xFF) / 255,
              blue: Double(hex & 0xFF) / 255, opacity: 1)
  }
}
