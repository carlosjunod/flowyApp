import SwiftUI
import Combine

// View model shared between ShareViewController and the SwiftUI tree it hosts.
// Owns the visible status enum, the user's selected + recent tags, the
// bottom-sheet presentation flag, and the auto-dismiss timer.
//
// Why a single model instead of multiple @State + a status enum?
// The extension dismisses itself via a callback (`onAutoDismiss`) that the
// hosting UIViewController installs. Concentrating the timer + status + sheet
// state in one place keeps that pause/resume logic out of every SwiftUI view
// that wants to influence it (e.g. the tag picker pausing dismiss while open).

@MainActor
final class ShareViewModel: ObservableObject {
  enum Status: Equatable {
    case loading
    case success
    case failure(String)
  }

  @Published var status: Status = .loading
  @Published var selectedTags: [String] = []
  @Published var recentTags: [String] = []
  @Published var isSheetPresented: Bool = false

  /// Called when the auto-dismiss timer fires. Set by the hosting view controller.
  var onAutoDismiss: (() -> Void)?

  private let appGroup: String
  private let defaults: UserDefaults?
  private let recentTagsKey = "flowy.recentTags"
  private let recentTagsCap = 20

  private var dismissTask: Task<Void, Never>?
  private let dismissDelaySeconds: Double = 3.0

  init(appGroup: String) {
    self.appGroup = appGroup
    // Returns nil if the app group isn't entitled — treat as "first launch,
    // no recents." Don't crash; the share extension still needs to ingest.
    self.defaults = UserDefaults(suiteName: appGroup)
    loadRecentTags()
  }

  deinit {
    dismissTask?.cancel()
  }

  // MARK: - Status

  func update(_ next: Status) {
    status = next
  }

  // MARK: - Tag selection

  func toggleTag(_ raw: String) {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    if let idx = selectedTags.firstIndex(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) {
      selectedTags.remove(at: idx)
    } else {
      selectedTags.append(trimmed)
      bumpRecent(trimmed)
    }
  }

  func removeSelected(_ tag: String) {
    selectedTags.removeAll { $0.caseInsensitiveCompare(tag) == .orderedSame }
  }

  func isSelected(_ tag: String) -> Bool {
    selectedTags.contains { $0.caseInsensitiveCompare(tag) == .orderedSame }
  }

  // MARK: - Auto-dismiss

  func scheduleAutoDismiss() {
    cancelAutoDismiss()
    dismissTask = Task { [weak self] in
      let nanos = UInt64((self?.dismissDelaySeconds ?? 3.0) * 1_000_000_000)
      try? await Task.sleep(nanoseconds: nanos)
      guard !Task.isCancelled else { return }
      await MainActor.run { self?.onAutoDismiss?() }
    }
  }

  func cancelAutoDismiss() {
    dismissTask?.cancel()
    dismissTask = nil
  }

  // MARK: - Sheet presentation

  func presentSheet() {
    cancelAutoDismiss()
    isSheetPresented = true
  }

  func dismissSheet() {
    isSheetPresented = false
    // Resume the dismiss countdown so the success screen still goes away
    // once the user is done picking tags — unless they navigated away from
    // success in the meantime (failure path doesn't auto-dismiss this way).
    if status == .success {
      scheduleAutoDismiss()
    }
  }

  // MARK: - Recent tags persistence

  private func loadRecentTags() {
    guard let defaults,
          let arr = defaults.array(forKey: recentTagsKey) as? [String] else { return }
    recentTags = arr
  }

  private func bumpRecent(_ tag: String) {
    var next = recentTags.filter { $0.caseInsensitiveCompare(tag) != .orderedSame }
    next.insert(tag, at: 0)
    if next.count > recentTagsCap {
      next = Array(next.prefix(recentTagsCap))
    }
    recentTags = next
    defaults?.set(next, forKey: recentTagsKey)
  }

  // Seed an initial recent-tags list the first time the picker opens, so
  // the empty state doesn't look broken. Idempotent: only seeds when empty.
  func seedRecentTagsIfEmpty() {
    guard recentTags.isEmpty else { return }
    let seed = ["IA", "3D print", "Tool", "Programming"]
    recentTags = seed
    defaults?.set(seed, forKey: recentTagsKey)
  }
}
