import SwiftUI

// The MyMind-style success screen shown after /api/ingest accepts the share.
//
// Layout:   mesh background → top progress bar → centered pen icon + serif
//           tagline → "+ Add Tags/Notes" pill near the bottom.
// Motion:   pen icon uses PhaseAnimator (.enter → .idle loop), the progress
//           bar is a TimelineView-driven Capsule, and the whole stack fades
//           in on first appear.
// Dismiss:  on appear we ask the view model to schedule a 3s auto-dismiss.
//           The pill press will pause that timer when the sheet opens; the
//           sheet's onDismiss resumes it. All that machinery lives in the
//           model — this view just calls scheduleAutoDismiss() once.

struct SuccessView: View {
  @ObservedObject var viewModel: ShareViewModel
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  /// Caller (StatusView) provides this so the parent can own the
  /// matchedGeometryEffect namespace and morph the pill into the sheet
  /// header. The pill itself reads from this namespace via geometry id
  /// "tag-surface".
  let namespace: Namespace.ID

  /// Wall-clock time the screen first appeared. Set by .onAppear so the
  /// progress bar can drive 0→1 over `autoDismissSeconds`. Optional so we
  /// can detect "first appear" cleanly.
  @State private var appearedAt: Date?

  /// Frozen elapsed seconds while the sheet is open. nil means "running".
  /// When the sheet opens we snapshot the elapsed-so-far here; when it
  /// closes we re-base `appearedAt` so the bar continues from this point
  /// rather than jumping forward to wherever wall-clock now sits.
  @State private var pausedElapsed: TimeInterval?

  private let autoDismissSeconds: TimeInterval = 3.0

  /// Action invoked when the user taps the pill or the background. Hosting
  /// view controller dismisses the extension on its own auto-dismiss
  /// callback — the tap-anywhere shortcut shares the same exit.
  let onAddTags: () -> Void
  let onDismiss: () -> Void

  var body: some View {
    ZStack {
      MeshDriftBackground()
        .contentShape(Rectangle())
        .onTapGesture { onDismiss() }

      VStack {
        progressBar
          .padding(.horizontal, 16)
          .padding(.top, 8)
        Spacer()
      }

      VStack(spacing: 18) {
        Spacer()
        penIcon
        tagline
        Spacer()
        addTagsPill
          .padding(.bottom, 56)
      }
      .padding(.horizontal, 32)
    }
    .onAppear {
      appearedAt = Date()
      viewModel.scheduleAutoDismiss()
      Haptics.success()
    }
    .onChange(of: viewModel.isSheetPresented) { _, isOpen in
      if isOpen {
        // Snapshot how much of the bar has filled so we don't jump forward
        // when the sheet finally closes. The TimelineView reads from
        // pausedElapsed first when set, so the capsule visually freezes.
        pausedElapsed = elapsedSinceAppear()
      } else if let paused = pausedElapsed {
        // Rebase appearedAt so the remaining bar continues smoothly.
        appearedAt = Date().addingTimeInterval(-paused)
        pausedElapsed = nil
        Haptics.sheetDismissed()
      }
    }
  }

  // MARK: - Progress bar

  private var progressBar: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule()
          .fill(Color.white.opacity(0.18))
        TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: pausedElapsed != nil)) { _ in
          let elapsed = pausedElapsed ?? elapsedSinceAppear()
          let progress = min(1.0, elapsed / autoDismissSeconds)
          Capsule()
            .fill(Color.white.opacity(0.78))
            .frame(width: geo.size.width * progress)
        }
      }
    }
    .frame(height: 3)
    .clipShape(Capsule())
  }

  private func elapsedSinceAppear() -> TimeInterval {
    guard let appearedAt else { return 0 }
    return max(0, Date().timeIntervalSince(appearedAt))
  }

  // MARK: - Pen icon (PhaseAnimator)

  private enum IconPhase: CaseIterable { case idle, breathe }

  private var penIcon: some View {
    Group {
      if reduceMotion {
        penGlyph
          .scaleEffect(1.0)
          .opacity(1.0)
      } else {
        // Two-phase loop so PhaseAnimator stays in steady-state animation
        // without ever running an exit. .smooth at ~2.5s gives a slow,
        // breath-like rise-and-fall around y: -2 and scale 1.02.
        PhaseAnimator(IconPhase.allCases) { phase in
          penGlyph
            .scaleEffect(phase == .breathe ? 1.04 : 1.0)
            .offset(y: phase == .breathe ? -3 : 0)
            .opacity(phase == .breathe ? 1.0 : 0.94)
        } animation: { _ in
          .smooth(duration: 2.4)
        }
        // Initial reveal: start small + transparent and spring to size on appear.
        .transition(.scale(scale: 0.6).combined(with: .opacity))
      }
    }
    .frame(width: 56, height: 56)
  }

  private var penGlyph: some View {
    // SF Symbol that visually matches the reference's pen-in-oval icon.
    // The thin stroke + warm-white tint reads against the gradient without
    // washing out on the orange band.
    Image(systemName: "applepencil.tip")
      .resizable()
      .aspectRatio(contentMode: .fit)
      .foregroundStyle(Color.white.opacity(0.95))
      .padding(6)
      .background(
        Circle()
          .stroke(Color.white.opacity(0.85), lineWidth: 1.2)
      )
  }

  // MARK: - Tagline

  private var tagline: some View {
    VStack(spacing: 2) {
      Text("Good find!")
      Text("It's in your mind.")
    }
    .font(.system(size: 32, weight: .regular, design: .serif).italic())
    .foregroundStyle(Color.white)
    .multilineTextAlignment(.center)
    .shadow(color: Color.black.opacity(0.18), radius: 8, y: 2)
  }

  // MARK: - + Add Tags/Notes pill

  private var addTagsPill: some View {
    Button(action: onAddTags) {
      Text("+ Add Tags/Notes")
        .font(.system(size: 16, weight: .medium, design: .rounded))
        .foregroundStyle(Color.white)
        .padding(.vertical, 12)
        .padding(.horizontal, 28)
        .background(
          Capsule()
            .stroke(Color.white.opacity(0.85), lineWidth: 1.2)
        )
        // The geometry effect ties this pill to the sheet header so when
        // .presentationDetents fires, the shape morphs into the top of the
        // tag picker rather than fading independently.
        .matchedGeometryEffect(id: "tag-surface", in: namespace)
    }
    .buttonStyle(.plain)
  }
}
