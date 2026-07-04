import SwiftUI

// MARK: - Reusable components
//
// The shared building blocks for Pubster's warm-pub redesign. Feature views
// compose these rather than styling things inline. Tokens live in Theme.swift.

// MARK: Screen background

/// Cream gradient that fills the screen. Place at the back of a ZStack.
struct ScreenBackground: View {
    var body: some View {
        LinearGradient.pubBackgroundGradient
            .ignoresSafeArea()
    }
}

// MARK: Card

/// Warm surface container with hairline border and soft shadow.
struct Card<Content: View>: View {
    var padding: CGFloat
    var cornerRadius: CGFloat
    @ViewBuilder var content: () -> Content

    init(padding: CGFloat = Spacing.lg,
         cornerRadius: CGFloat = Radius.card,
         @ViewBuilder content: @escaping () -> Content) {
        self.padding = padding
        self.cornerRadius = cornerRadius
        self.content = content
    }

    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(Color.pubSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(Color.pubBorder, lineWidth: 1)
            )
            .softShadow()
    }
}

// MARK: Buttons

/// Full-width amber-gradient primary action with pressed + loading states.
struct PrimaryButton: View {
    let title: String
    var systemImage: String?
    var isLoading: Bool = false
    let action: () -> Void

    init(title: String, systemImage: String? = nil, isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            ZStack {
                HStack(spacing: Spacing.sm) {
                    if let systemImage {
                        Image(systemName: systemImage)
                    }
                    Text(title)
                }
                .opacity(isLoading ? 0 : 1)
                if isLoading {
                    ProgressView().tint(.white)
                }
            }
            .font(.pubButton)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
        }
        .buttonStyle(PrimaryButtonStyle())
        .disabled(isLoading)
    }
}

private struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(
                RoundedRectangle(cornerRadius: Radius.button, style: .continuous)
                    .fill(LinearGradient.pubAccentGradient)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.button, style: .continuous)
                    .fill(Color.black.opacity(configuration.isPressed ? 0.14 : 0))
            )
            .shadow(color: Color.pubAccentDark.opacity(0.30),
                    radius: configuration.isPressed ? 4 : 10,
                    x: 0, y: configuration.isPressed ? 2 : 6)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

/// Full-width outlined secondary action.
struct SecondaryButton: View {
    let title: String
    var systemImage: String?
    var isLoading: Bool = false
    let action: () -> Void

    init(title: String, systemImage: String? = nil, isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            ZStack {
                HStack(spacing: Spacing.sm) {
                    if let systemImage {
                        Image(systemName: systemImage)
                    }
                    Text(title)
                }
                .opacity(isLoading ? 0 : 1)
                if isLoading {
                    ProgressView().tint(.pubAccent)
                }
            }
            .font(.pubButton)
            .foregroundStyle(Color.pubAccent)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(
                RoundedRectangle(cornerRadius: Radius.button, style: .continuous)
                    .fill(Color.pubSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.button, style: .continuous)
                    .strokeBorder(Color.pubAccent.opacity(0.4), lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}

/// Compact inline text button (amber).
struct TextButton: View {
    let title: String
    var systemImage: String?
    var role: ButtonRole?
    let action: () -> Void

    init(_ title: String, systemImage: String? = nil, role: ButtonRole? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.role = role
        self.action = action
    }

    var body: some View {
        Button(role: role, action: action) {
            HStack(spacing: Spacing.xs) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
            }
            .font(.pubLabel)
            .foregroundStyle(role == .destructive ? Color.pubError : Color.pubAccent)
        }
        .buttonStyle(.plain)
    }
}

// MARK: Fields

/// Cream fill + warm border text-field styling.
struct FieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.pubBody)
            .foregroundStyle(Color.pubTextPrimary)
            .tint(.pubAccent)
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: Radius.field, style: .continuous)
                    .fill(Color.pubSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.field, style: .continuous)
                    .strokeBorder(Color.pubBorder, lineWidth: 1)
            )
            .autocorrectionDisabled()
    }
}

/// Label-above-field pattern used across forms.
struct LabeledField<Content: View>: View {
    let label: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(label.uppercased())
                .font(.pubCaption)
                .tracking(0.6)
                .foregroundStyle(Color.pubTextSecondary)
            content()
                .modifier(FieldStyle())
        }
    }
}

// MARK: Pill

/// Small rounded badge — distance, status, "event tonight", cover charge, etc.
/// Pass a palette tint such as `.pubAccent`, `.pubGold`, `.pubSuccess`, `.pubError`.
struct PillLabel: View {
    let text: String
    var systemImage: String?
    var tint: Color

    init(_ text: String, systemImage: String? = nil, tint: Color = .pubAccent) {
        self.text = text
        self.systemImage = systemImage
        self.tint = tint
    }

    var body: some View {
        HStack(spacing: Spacing.xs) {
            if let systemImage {
                Image(systemName: systemImage)
            }
            Text(text)
        }
        .font(.pubCaption)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .foregroundStyle(tint)
        .background(
            Capsule().fill(tint.opacity(0.14))
        )
        .overlay(
            Capsule().strokeBorder(tint.opacity(0.22), lineWidth: 1)
        )
    }
}

// MARK: Pub thumbnail

/// Gradient placeholder standing in for a pub photo (pubs have no images):
/// amber → espresso rounded rect with a large translucent SF Symbol.
struct PubThumbnail: View {
    var size: CGFloat = 60
    var cornerRadius: CGFloat = Radius.field
    var symbol: String = "mug.fill"

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(LinearGradient.pubHeroGradient)
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: symbol)
                    .font(.system(size: size * 0.46, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.9))
            }
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(.white.opacity(0.15), lineWidth: 1)
            )
            .softShadow(radius: 8, y: 4, opacity: 0.12)
    }
}

// MARK: Section header

/// Serif section heading.
struct SectionHeader: View {
    let title: String
    var subtitle: String?

    init(_ title: String, subtitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.pubHeadline)
                .foregroundStyle(Color.pubEspresso)
            if let subtitle {
                Text(subtitle)
                    .font(.pubCaption)
                    .foregroundStyle(Color.pubTextSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: Slot chip

/// Selectable time-slot chip. Available = surface + border, selected = amber
/// fill, unavailable = muted & disabled.
struct SlotChip: View {
    enum ChipState { case available, selected, unavailable }

    let title: String
    var subtitle: String?
    let state: ChipState
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(title)
                    .font(.pubBodyEmphasis)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .opacity(0.85)
                }
            }
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: Radius.chip, style: .continuous)
                    .fill(fill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.chip, style: .continuous)
                    .strokeBorder(border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(state == .unavailable)
    }

    private var foreground: Color {
        switch state {
        case .available: return .pubTextPrimary
        case .selected: return .white
        case .unavailable: return .pubTextSecondary.opacity(0.5)
        }
    }

    private var fill: AnyShapeStyle {
        switch state {
        case .available: return AnyShapeStyle(Color.pubSurface)
        case .selected: return AnyShapeStyle(LinearGradient.pubAccentGradient)
        case .unavailable: return AnyShapeStyle(Color.pubBorder.opacity(0.25))
        }
    }

    private var border: Color {
        switch state {
        case .available: return .pubBorder
        case .selected: return .clear
        case .unavailable: return .pubBorder.opacity(0.4)
        }
    }
}

// MARK: Segmented control

/// Custom capsule segmented control (selected segment = amber gradient).
struct SegmentedPicker<T: Hashable>: View {
    let options: [T]
    let title: (T) -> String
    @Binding var selection: T
    @Namespace private var namespace

    var body: some View {
        HStack(spacing: 4) {
            ForEach(options, id: \.self) { option in
                let selected = option == selection
                Button {
                    withAnimation(.easeOut(duration: 0.2)) { selection = option }
                } label: {
                    Text(title(option))
                        .font(.pubLabel)
                        .foregroundStyle(selected ? .white : Color.pubTextSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background {
                            if selected {
                                Capsule()
                                    .fill(LinearGradient.pubAccentGradient)
                                    .matchedGeometryEffect(id: "segment", in: namespace)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Capsule().fill(Color.pubSurface))
        .overlay(Capsule().strokeBorder(Color.pubBorder, lineWidth: 1))
    }
}

// MARK: Party-size stepper

/// Amber +/- stepper for party size.
struct PartyStepper: View {
    @Binding var count: Int
    var range: ClosedRange<Int> = 1...20

    var body: some View {
        HStack(spacing: Spacing.lg) {
            stepperButton(symbol: "minus", enabled: count > range.lowerBound) {
                if count > range.lowerBound { count -= 1 }
            }
            VStack(spacing: 0) {
                Text("\(count)")
                    .font(.system(size: 28, weight: .bold, design: .serif))
                    .foregroundStyle(Color.pubEspresso)
                    .contentTransition(.numericText())
                Text(count == 1 ? "guest" : "guests")
                    .font(.pubCaption)
                    .foregroundStyle(Color.pubTextSecondary)
            }
            .frame(minWidth: 72)
            stepperButton(symbol: "plus", enabled: count < range.upperBound) {
                if count < range.upperBound { count += 1 }
            }
        }
    }

    private func stepperButton(symbol: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.easeOut(duration: 0.15)) { action() }
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(
                    Circle().fill(LinearGradient.pubAccentGradient)
                )
                .opacity(enabled ? 1 : 0.4)
                .softShadow(radius: 6, y: 3, opacity: 0.15)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

// MARK: State views

/// Amber-tinted loading state with a friendly message.
struct LoadingStateView: View {
    var message: String

    var body: some View {
        VStack(spacing: Spacing.lg) {
            ProgressView()
                .controlSize(.large)
                .tint(.pubAccent)
            Text(message)
                .font(.pubBody)
                .foregroundStyle(Color.pubTextSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Friendly empty / error state — icon in an amber circle, serif title, message
/// and an optional action.
struct EmptyStateView: View {
    var icon: String
    var title: String
    var message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: Spacing.lg) {
            ZStack {
                Circle()
                    .fill(Color.pubAccent.opacity(0.12))
                    .frame(width: 92, height: 92)
                Image(systemName: icon)
                    .font(.system(size: 38, weight: .semibold))
                    .foregroundStyle(Color.pubAccent)
            }
            VStack(spacing: Spacing.sm) {
                Text(title)
                    .font(.pubHeadline)
                    .foregroundStyle(Color.pubEspresso)
                Text(message)
                    .font(.pubBody)
                    .foregroundStyle(Color.pubTextSecondary)
                    .multilineTextAlignment(.center)
            }
            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(.pubButton)
                        .foregroundStyle(Color.pubAccent)
                        .padding(.horizontal, Spacing.xl)
                        .padding(.vertical, Spacing.md)
                        .background(Capsule().fill(Color.pubAccent.opacity(0.12)))
                }
                .buttonStyle(.plain)
                .padding(.top, Spacing.xs)
            }
        }
        .padding(Spacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
