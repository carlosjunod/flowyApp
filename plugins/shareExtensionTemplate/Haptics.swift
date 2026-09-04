import UIKit

// Thin wrapper over the three feedback generators we actually use, so call
// sites read like Haptics.success() rather than allocating + prepare()-ing
// inline at every trigger point. The extension's memory cap is tight; we
// allocate the generators lazily and discard immediately after firing.

enum Haptics {
  /// Fire on the success-screen reveal — the celebratory "save landed" cue.
  static func success() {
    let g = UINotificationFeedbackGenerator()
    g.prepare()
    g.notificationOccurred(.success)
  }

  /// Fire when the user adds a tag chip — sharp, lightweight, frequent.
  static func tagAdded() {
    let g = UIImpactFeedbackGenerator(style: .light)
    g.prepare()
    g.impactOccurred()
  }

  /// Fire when the bottom sheet dismisses — softer, less attention-grabbing
  /// since dismissal is a quiet outcome.
  static func sheetDismissed() {
    let g = UIImpactFeedbackGenerator(style: .soft)
    g.prepare()
    g.impactOccurred()
  }
}
