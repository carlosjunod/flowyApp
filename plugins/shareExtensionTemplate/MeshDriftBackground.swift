import SwiftUI

// Animated warm/cool background used behind the success screen.
//
// On iOS 18+: an actual MeshGradient with a 3x3 control grid whose four
// interior points drift on sin/cos curves. The corner points are pinned so
// the gradient stays bonded to the view bounds — moving a corner causes the
// fill to detach and reveal whatever is underneath.
//
// On iOS 17:   LinearGradient with a slow .hueRotation driven by the same
// TimelineView. The cost is negligible and the silhouette matches the
// MeshGradient version closely enough that the success screen reads the
// same on both targets.
//
// Reduce-motion: TimelineView is bypassed entirely — both paths render at
// t=0 as a static image.

struct MeshDriftBackground: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  // Palette tuned to the reference: warm orange, deep navy, peach lift, slate top.
  private static let warmOrange = Color(red: 0.95, green: 0.45, blue: 0.10)
  private static let peach     = Color(red: 0.98, green: 0.68, blue: 0.35)
  private static let navy      = Color(red: 0.08, green: 0.12, blue: 0.24)
  private static let slate     = Color(red: 0.78, green: 0.81, blue: 0.86)
  private static let coolBlue  = Color(red: 0.30, green: 0.55, blue: 0.85)

  var body: some View {
    if #available(iOS 18.0, *) {
      meshGradient
    } else {
      fallbackLinearGradient
    }
  }

  // MARK: - iOS 18+ MeshGradient

  @available(iOS 18.0, *)
  private var meshGradient: some View {
    Group {
      if reduceMotion {
        meshFrame(at: 0)
      } else {
        TimelineView(.animation) { context in
          let t = context.date.timeIntervalSinceReferenceDate
          meshFrame(at: t)
        }
      }
    }
    .ignoresSafeArea()
  }

  @available(iOS 18.0, *)
  private func meshFrame(at t: TimeInterval) -> some View {
    // Slow phase — full breath cycle ~12s. Each interior point drifts on a
    // different sin/cos so the gradient feels organic rather than uniform.
    let phase = t * 0.5
    let dxTop    = Float(sin(phase) * 0.08)
    let dyLeft   = Float(cos(phase * 1.1 + 0.4) * 0.05)
    let dxCenter = Float(cos(phase * 0.6 + 0.9) * 0.07)
    let dyCenter = Float(sin(phase * 0.9 + 2.1) * 0.06)
    let dyRight  = Float(cos(phase * 0.4 + 1.7) * 0.08)
    let dxBottom = Float(sin(phase * 1.2 + 0.2) * 0.05)

    let points: [SIMD2<Float>] = [
      // Top row — corners pinned, top-center drifts horizontally.
      SIMD2(0.00, 0.00), SIMD2(0.50 + dxTop, 0.00), SIMD2(1.00, 0.00),
      // Middle row — interior points free in both axes.
      SIMD2(0.00, 0.50 + dyLeft), SIMD2(0.50 + dxCenter, 0.50 + dyCenter), SIMD2(1.00, 0.50 + dyRight),
      // Bottom row — bottom-center drifts, corners pinned.
      SIMD2(0.00, 1.00), SIMD2(0.50 + dxBottom, 1.00), SIMD2(1.00, 1.00),
    ]

    let colors: [Color] = [
      Self.slate,      Self.slate.opacity(0.92),  Self.peach.opacity(0.85),
      Self.warmOrange, Self.warmOrange,           Self.peach,
      Self.navy,       Self.navy.opacity(0.92),   Self.coolBlue.opacity(0.85),
    ]

    return MeshGradient(width: 3, height: 3, points: points, colors: colors)
  }

  // MARK: - iOS 17 fallback

  private var fallbackLinearGradient: some View {
    let stops: [Gradient.Stop] = [
      .init(color: Self.slate,      location: 0.00),
      .init(color: Self.peach,      location: 0.30),
      .init(color: Self.warmOrange, location: 0.55),
      .init(color: Self.navy,       location: 0.85),
      .init(color: Self.coolBlue,   location: 1.00),
    ]
    let gradient = LinearGradient(
      gradient: Gradient(stops: stops),
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )

    return Group {
      if reduceMotion {
        gradient
      } else {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { context in
          // ~24s full hue cycle — slow enough to never feel like a rotating
          // disco ball, fast enough that you notice the warmth shift.
          let t = context.date.timeIntervalSinceReferenceDate
          let degrees = (sin(t * 0.13) * 12.0) // ±12° around base hue
          gradient.hueRotation(.degrees(degrees))
        }
      }
    }
    .ignoresSafeArea()
  }
}
