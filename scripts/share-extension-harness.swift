// Compiled together with the production template by test-share-extension.sh.
// This simulator-only host intercepts every request; it never contacts Flowy.
private final class ShareMockProtocol: URLProtocol {
  static var item: [String: Any] = ["tags": ["Design"], "notes": "An existing thought."]
  static var patch: [String: Any] = [:]
  static var failPatch = false
  static var statusOverride: Int?
  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    var body: [String: Any] = [:]
    if request.httpMethod == "POST" {
      body = ["data": ["id": "testitem123", "status": "pending"]]
    } else if request.httpMethod == "PATCH" {
      var bytes = request.httpBody ?? Data()
      if let stream = request.httpBodyStream {
        stream.open()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
          let count = stream.read(&buffer, maxLength: buffer.count)
          if count <= 0 { break }
          bytes.append(buffer, count: count)
        }
        stream.close()
      }
      Self.patch = (try? JSONSerialization.jsonObject(with: bytes) as? [String: Any]) ?? [:]
      body = ["data": Self.item]
    } else { body = Self.item }
    let code = Self.statusOverride ?? (request.httpMethod == "PATCH" && Self.failPatch ? 500 : 200)
    client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: try! JSONSerialization.data(withJSONObject: body))
    client?.urlProtocolDidFinishLoading(self)
  }
  override func stopLoading() {}
}

private func check(_ condition: @autoclosure () -> Bool, _ message: String) {
  precondition(condition(), message)
}

private extension ShareViewController {
  static func checkAuthentication() async throws {
    let signedOut = ShareViewController()
    await signedOut.process(token: nil)
    check(signedOut.state.state == .signInRequired, "A missing session needs the sign-in screen")
    signedOut.state.startCountdown()
    check(!signedOut.state.countingDown && !signedOut.hasFinished, "Sign-in instructions must stay open")
    let empty = ShareViewController()
    await empty.process(token: "")
    check(empty.state.state == .signInRequired, "An empty session also needs sign-in")

    let expired = ShareViewController()
    ShareMockProtocol.statusOverride = 401
    defer { ShareMockProtocol.statusOverride = nil }
    do {
      _ = try await expired.postIngest(payload: expired.makeURLPayload(URL(string: "https://example.com")!), token: "expired-fixture")
      preconditionFailure("A 401 must not become a saved receipt")
    } catch {
      expired.handleIngestError(error)
    }
    check(expired.state.state == .signInRequired, "An expired server session needs the same sign-in screen")
    check(!expired.state.countingDown && !expired.hasFinished, "A 401 must not auto-close")

    let editing = ShareViewController()
    editing.authToken = "expired-fixture"
    editing.savedID = "testitem123"
    await editing.loadAnnotations()
    check(editing.state.editorError?.contains("session has ended") == true, "Metadata authentication errors need specific instructions")
    editing.state.annotationsLoaded = true
    editing.state.notes = "Keep my unsaved draft"
    await editing.saveAnnotations()
    check(editing.state.notes == "Keep my unsaved draft" && !editing.hasFinished, "Authentication failure must preserve an annotation draft")

    ShareMockProtocol.statusOverride = 500
    do {
      _ = try await expired.postIngest(payload: expired.makeURLPayload(URL(string: "https://example.com")!), token: "valid-fixture")
      preconditionFailure("A 500 must fail")
    } catch { expired.handleIngestError(error) }
    if case .failure(let message) = expired.state.state {
      check(!message.contains("UNAUTHORIZED") && !message.contains("{"), "Transport failures must use readable copy")
    } else { preconditionFailure("A server failure must not be described as signed out") }
  }

  static func checkAnnotations() async throws {
    let controller = ShareViewController()
    controller.authToken = "simulator-fixture"
    controller.savedID = "testitem123"
    let id = try await controller.postIngest(payload: controller.makeURLPayload(URL(string: "https://example.com")!), token: "simulator-fixture")
    check(id == "testitem123", "Ingest receipt must retain the saved ID")
    await controller.loadAnnotations()
    check(controller.state.tags == ["Design"], "Duplicate share must load existing tags")
    check(controller.state.notes == "An existing thought.", "Duplicate share must load existing notes")
    controller.state.tagDraft = "My project"
    controller.state.notes = "A new thought."
    ShareMockProtocol.item["tags"] = ["Design", "Automatic tag"]
    await controller.saveAnnotations()
    check(ShareMockProtocol.patch["tags"] as? [String] == ["Design", "My project", "Automatic tag"], "Save must merge tags added while editing and commit an unsubmitted tag")
    check(ShareMockProtocol.patch["notes"] as? String == "A new thought.", "Notes must use the dedicated field")
    check(controller.hasFinished, "Successful annotation save should close")

    let failed = ShareViewController()
    failed.authToken = "simulator-fixture"
    failed.savedID = "testitem123"
    await failed.loadAnnotations()
    failed.state.notes = "Keep this draft"
    ShareMockProtocol.failPatch = true
    await failed.saveAnnotations()
    check(!failed.hasFinished && failed.state.editorError != nil, "Failed annotation save must stay open")
    check(failed.state.notes == "Keep this draft", "Failed save must preserve the draft")
    ShareMockProtocol.failPatch = false
    await failed.saveAnnotations()
    check(failed.hasFinished, "Retry must save and close")

    let unchanged = ShareViewController()
    unchanged.authToken = "simulator-fixture"
    unchanged.savedID = "testitem123"
    await unchanged.loadAnnotations()
    ShareMockProtocol.patch = [:]
    await unchanged.saveAnnotations()
    check(ShareMockProtocol.patch.isEmpty, "Skipping edits must not overwrite existing metadata")
  }
}

@MainActor private func runShareChecks() async throws {
  try await ShareViewController.checkAuthentication()
  try await ShareViewController.checkAnnotations()
  let copySuite = "app.tryflowy.sharecopy.tests.\(UUID().uuidString)"
  let copyDefaults = UserDefaults(suiteName: copySuite)!
  defer { copyDefaults.removePersistentDomain(forName: copySuite) }
  check(ShareSuccessCopy.titles.count == 10 && Set(ShareSuccessCopy.titles).count == 10, "Keep ten distinct success phrases")
  var previousPhrase: String?
  for _ in 0..<30 {
    let phrase = ShareSuccessCopy.choose(using: copyDefaults)
    check(ShareSuccessCopy.titles.contains(phrase) && phrase != previousPhrase, "Choose from the set without repeating the last phrase")
    previousPhrase = phrase
  }
  let stable = StatusState()
  let chosenPhrase = stable.successTitle
  stable.update(.success)
  stable.interact()
  stable.stage = .tags
  check(stable.successTitle == chosenPhrase, "The phrase must stay fixed while interacting")
  let swipe = StatusState()
  check(!swipe.canSwipeDismiss, "Never swipe-dismiss an upload")
  swipe.update(.success)
  check(swipe.canSwipeDismiss, "Saved confirmation supports manual dismissal")
  swipe.interact()
  check(swipe.canSwipeDismiss, "Interaction cancels the timer, not manual dismissal")
  swipe.stage = .notes
  check(!swipe.canSwipeDismiss, "Swiping must not discard a note draft")
  swipe.stage = .tags
  check(!swipe.canSwipeDismiss, "Swiping must not discard a tag draft")
  swipe.stage = .confirmation
  swipe.metadataBusy = true
  check(!swipe.canSwipeDismiss, "Do not dismiss during annotation writes")
  check(!ShareDismissPan.shouldDismiss(distance: 20, velocity: 1500), "Tiny fast motions are not a dismissal")
  check(!ShareDismissPan.shouldDismiss(distance: 70, velocity: 100), "Short pulls return to their starting position")
  check(ShareDismissPan.shouldDismiss(distance: 110, velocity: 0), "A deliberate long pull dismisses")
  check(ShareDismissPan.shouldDismiss(distance: 35, velocity: 800), "A deliberate downward flick dismisses")
  swipe.dismissDrag = 55
  swipe.resetDismissDrag()
  check(swipe.dismissDrag == 0, "Cancelled pulls reset their translation")
  let touched = StatusState()
  touched.interact() // includes touches while the initial upload is running
  touched.update(.success)
  touched.startCountdown()
  check(!touched.countingDown, "A touch before success must prevent auto-close")

  let cancelled = StatusState()
  var incorrectlyClosed = false
  cancelled.onAutoDismiss = { incorrectlyClosed = true }
  cancelled.update(.success)
  cancelled.startCountdown()
  try await Task.sleep(nanoseconds: 100_000_000)
  check(cancelled.remaining < 1, "Progress must count down")
  cancelled.interact()
  let remaining = cancelled.remaining

  let automatic = StatusState()
  var automaticallyClosed = false
  automatic.onAutoDismiss = { automaticallyClosed = true }
  automatic.update(.success)
  automatic.startCountdown()
  try await Task.sleep(nanoseconds: 5_300_000_000)
  check(automaticallyClosed, "An untouched success must close after five seconds")
  check(!incorrectlyClosed && cancelled.remaining == remaining, "Interaction must cancel the timer permanently")
  cancelled.startCountdown()
  check(!cancelled.countingDown, "Cancelled timer must not restart")

  let tags = StatusState()
  tags.tagDraft = "  #Design  "
  tags.addTag()
  tags.tagDraft = "design"
  tags.addTag()
  check(tags.tags == ["Design"], "Tags must trim whitespace/hash and deduplicate case-insensitively")
  tags.tagDraft = String(repeating: "x", count: 65)
  tags.addTag()
  check(tags.tagError != nil && tags.tags.count == 1, "Overlong tags must not be silently truncated")
  tags.tags = (1...20).map { "tag\($0)" }
  tags.tagDraft = "one too many"
  tags.addTag()
  check(tags.tags.count == 20 && tags.tagError != nil, "Tag count must respect the API cap")
  let dismissal = StatusState()
  var completions = 0
  dismissal.beginDismissal { completions += 1 }
  dismissal.beginDismissal { completions += 1 }
  check(dismissal.isDismissing && completions == 0, "Dismissal must allow its exit animation before completion")
  try await Task.sleep(nanoseconds: 250_000_000)
  check(completions == 1, "Dismissal must complete exactly once")
  let result = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("share-checks.txt")
  try "PASS: swipe eligibility, distance/velocity thresholds, cancelled pull reset, missing/expired authentication, annotation auth failure, server failure distinction, random non-repeating copy, stable copy, dismissal, countdown, touch cancellation, tag limits, ingest receipt, metadata merge, notes, failure draft, retry, unchanged save\n".write(to: result, atomically: true, encoding: .utf8)
}

@main final class ShareHarnessApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  private let state = StatusState()
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    URLProtocol.registerClass(ShareMockProtocol.self)
    UITextView.appearance().backgroundColor = .clear
    if let font = Bundle.main.url(forResource: "InstrumentSerif_400Regular", withExtension: "ttf") {
      CTFontManagerRegisterFontsForURL(font as CFURL, .process, nil)
    }
    let args = ProcessInfo.processInfo.arguments
    state.update(.success)
    state.source = "architecture.studio"
    state.onAutoDismiss = { [weak self] in self?.close() }
    if args.contains("--notes") {
      state.stage = .notes
      state.annotationsLoaded = true
    }
    if args.contains("--signed-out") { state.update(.signInRequired) }
    if args.contains("--error") { state.update(.failure("We couldn’t confirm the save. Check your connection and your Flowy inbox before sharing again.")) }
    if !args.contains("--countdown") { state.interact() }
    let host = UIHostingController(rootView: StatusView(state: state, onDismiss: { [weak self] in self?.close() }, onEdit: { [weak self] in
      self?.state.annotationsLoaded = true
    }, onSave: { [weak self] in self?.close() }))
    let touch = ShareTouchObserver(target: nil, action: nil)
    touch.onTouch = { [weak self] in self?.state.interact() }
    touch.cancelsTouchesInView = false
    touch.delaysTouchesBegan = false
    host.view.addGestureRecognizer(touch)
    host.view.addGestureRecognizer(ShareDismissPan(state: state) { [weak self] in self?.close() })
    let window = UIWindow(frame: UIScreen.main.bounds)
    window.rootViewController = host
    self.window = window
    window.makeKeyAndVisible()
    if args.contains("--countdown") { state.startCountdown() }
    if args.contains("--test") { Task { try await runShareChecks() } }
    return true
  }
  private func close() {
    state.beginDismissal { [weak self] in
      self?.window?.rootViewController = UIHostingController(rootView: Text("Share closed").font(.title))
    }
  }
}
