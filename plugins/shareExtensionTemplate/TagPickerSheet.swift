import SwiftUI
import UIKit

// Bottom sheet presented from the success screen's "+ Add Tags/Notes" pill.
// Three tabs at the top — Tags / Notes / Spaces — but only Tags is wired up
// in Phase 1; the other two show a friendly "Coming soon" placeholder.

struct TagPickerSheet: View {
  @ObservedObject var viewModel: ShareViewModel
  let namespace: Namespace.ID
  let onDone: () -> Void

  enum Tab: String, CaseIterable, Identifiable {
    case tags = "Tags"
    case notes = "Notes"
    case spaces = "Spaces"
    var id: String { rawValue }

    var systemImage: String {
      switch self {
      case .tags:   return "tag"
      case .notes:  return "doc.text"
      case .spaces: return "circle"
      }
    }
  }

  @State private var activeTab: Tab = .tags
  @Namespace private var tabUnderline

  var body: some View {
    VStack(spacing: 16) {
      tabRow
      tabContent
      Spacer(minLength: 0)
      doneButton
        .padding(.bottom, 24)
    }
    .padding(.top, 12)
    .background(
      // Subtle warm wash that picks up the gradient under the sheet.
      LinearGradient(
        colors: [
          Color(uiColor: .systemBackground).opacity(0.0),
          Color(uiColor: .systemBackground).opacity(0.4),
        ],
        startPoint: .top,
        endPoint: .bottom
      )
    )
    // The sheet header carries the same matched-geometry id as the pill in
    // SuccessView so the pill morphs into this surface rather than
    // crossfading. Placed as a hairline at the top so the visual anchor
    // matches where the pill used to sit.
    .overlay(alignment: .top) {
      Capsule()
        .fill(Color.clear)
        .frame(width: 1, height: 1)
        .matchedGeometryEffect(id: "tag-surface", in: namespace)
    }
  }

  // MARK: - Tabs

  private var tabRow: some View {
    HStack(spacing: 0) {
      ForEach(Tab.allCases) { tab in
        Button {
          withAnimation(.snappy) { activeTab = tab }
        } label: {
          VStack(spacing: 6) {
            HStack(spacing: 6) {
              Image(systemName: tab.systemImage)
                .font(.system(size: 14, weight: .semibold))
              Text(tab.rawValue)
                .font(.system(size: 16, weight: .semibold))
            }
            .foregroundStyle(activeTab == tab ? Color.primary : Color.secondary)
            ZStack {
              Capsule().fill(Color.clear).frame(height: 2)
              if activeTab == tab {
                Capsule()
                  .fill(Color.primary)
                  .frame(height: 2)
                  .matchedGeometryEffect(id: "tab-underline", in: tabUnderline)
              }
            }
            .frame(maxWidth: .infinity)
          }
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
      }
    }
    .padding(.horizontal, 24)
  }

  // MARK: - Tab content

  @ViewBuilder
  private var tabContent: some View {
    switch activeTab {
    case .tags:   TagsPanel(viewModel: viewModel)
    case .notes:  ComingSoonPanel(label: "Notes coming soon")
    case .spaces: ComingSoonPanel(label: "Spaces coming soon")
    }
  }

  // MARK: - Done CTA

  private var doneButton: some View {
    Button {
      onDone()
    } label: {
      Text("Done")
        .font(.system(size: 17, weight: .semibold))
        .foregroundStyle(Color.white)
        .frame(minWidth: 140)
        .padding(.vertical, 14)
        .background(
          Capsule().fill(Color(red: 0.95, green: 0.45, blue: 0.10))
        )
    }
    .buttonStyle(.plain)
  }
}

// MARK: - Tags panel

private struct TagsPanel: View {
  @ObservedObject var viewModel: ShareViewModel
  @State private var input: String = ""
  @FocusState private var inputFocused: Bool

  var body: some View {
    VStack(spacing: 14) {
      cardSurface {
        VStack(alignment: .leading, spacing: 0) {
          searchField
          if !viewModel.selectedTags.isEmpty {
            Divider().padding(.horizontal, 16)
            selectedChipsStrip
          }
          Divider().padding(.horizontal, 16)
          recentsList
        }
      }
      .padding(.horizontal, 16)
    }
    .onAppear {
      viewModel.seedRecentTagsIfEmpty()
    }
  }

  private func cardSurface<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
    content()
      .background(
        RoundedRectangle(cornerRadius: 18)
          .fill(Color(uiColor: .systemBackground))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 18)
          .stroke(Color(uiColor: .systemGray5), lineWidth: 0.5)
      )
      .shadow(color: Color.black.opacity(0.04), radius: 12, y: 4)
  }

  // MARK: - Search field

  private var searchField: some View {
    HStack(spacing: 10) {
      TextField("Start typing tags...", text: $input)
        .focused($inputFocused)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled(true)
        .submitLabel(.done)
        .onSubmit(commitInput)
        .font(.system(size: 17))
      if !input.isEmpty {
        Button {
          commitInput()
        } label: {
          Image(systemName: "chevron.up")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.secondary)
            .padding(6)
        }
        .buttonStyle(.plain)
        .transition(.opacity)
      } else {
        Image(systemName: "chevron.up")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(Color.secondary.opacity(0.5))
          .padding(6)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
  }

  private func commitInput() {
    let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    withAnimation(.snappy) {
      viewModel.toggleTag(trimmed)
    }
    input = ""
  }

  // MARK: - Selected chips strip

  private var selectedChipsStrip: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 8) {
        ForEach(viewModel.selectedTags, id: \.self) { tag in
          TagChip(label: tag) {
            withAnimation(.snappy) {
              viewModel.removeSelected(tag)
            }
          }
        }
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
    }
  }

  // MARK: - Recents list

  private var recentsList: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text("RECENT TAGS")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Color.secondary)
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 8)
      ForEach(viewModel.recentTags, id: \.self) { tag in
        recentRow(tag)
      }
      .padding(.bottom, 16)
    }
  }

  private func recentRow(_ tag: String) -> some View {
    let selected = viewModel.isSelected(tag)
    return Button {
      withAnimation(.snappy) {
        viewModel.toggleTag(tag)
      }
    } label: {
      HStack {
        Text(tag)
          .font(.system(size: 20))
          .foregroundStyle(selected ? Color.secondary : Color.primary)
          .strikethrough(selected, color: Color.secondary)
        Spacer()
        if selected {
          Image(systemName: "checkmark")
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(Color(red: 0.95, green: 0.45, blue: 0.10))
            .transition(.opacity)
        }
      }
      .contentShape(Rectangle())
      .padding(.horizontal, 16)
      .padding(.vertical, 10)
    }
    .buttonStyle(.plain)
  }
}

// MARK: - Coming-soon placeholder

private struct ComingSoonPanel: View {
  let label: String
  var body: some View {
    VStack(spacing: 12) {
      Spacer().frame(height: 60)
      Image(systemName: "wand.and.stars")
        .font(.system(size: 32, weight: .light))
        .foregroundStyle(Color.secondary)
      Text(label)
        .font(.system(size: 18, weight: .medium))
        .foregroundStyle(Color.secondary)
      Spacer()
    }
    .frame(maxWidth: .infinity)
  }
}
