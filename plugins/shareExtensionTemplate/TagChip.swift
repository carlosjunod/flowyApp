import SwiftUI
import UIKit

// A single selected-tag chip. Renders as a small pill with the tag label
// and a tappable × to remove it. Insertion/removal transitions are owned by
// the parent's withAnimation block — the chip just declares its own
// asymmetric transition so SwiftUI knows how to dissolve vs. pop.

struct TagChip: View {
  let label: String
  let onRemove: () -> Void

  var body: some View {
    HStack(spacing: 6) {
      Text(label)
        .font(.system(size: 14, weight: .medium))
        .foregroundStyle(Color.primary)
      Button(action: onRemove) {
        Image(systemName: "xmark")
          .font(.system(size: 10, weight: .bold))
          .foregroundStyle(Color.secondary)
          .padding(2)
      }
      .buttonStyle(.plain)
    }
    .padding(.vertical, 6)
    .padding(.leading, 12)
    .padding(.trailing, 8)
    .background(
      Capsule()
        .fill(Color(uiColor: .systemGray6))
    )
    .overlay(
      Capsule()
        .stroke(Color(uiColor: .systemGray4), lineWidth: 0.5)
    )
    // Asymmetric so newly added chips spring in but removed chips fade
    // quietly — matches the reference's snappy add / soft remove feel.
    .transition(.asymmetric(
      insertion: .scale(scale: 0.6).combined(with: .opacity),
      removal: .opacity
    ))
  }
}
