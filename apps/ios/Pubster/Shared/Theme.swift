import SwiftUI
import UIKit

// MARK: - Hex color helpers

extension UIColor {
    /// Create a `UIColor` from a 24-bit RGB hex value, e.g. `0x6C4CF1`.
    convenience init(rgb hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}

extension Color {
    /// Static color from a 24-bit RGB hex value.
    init(rgb hex: UInt32, alpha: Double = 1) {
        self.init(uiColor: UIColor(rgb: hex, alpha: CGFloat(alpha)))
    }

    /// An adaptive color that resolves to `light`/`dark` based on the trait
    /// environment — the core of the app's full light + dark support.
    static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(rgb: dark)
                : UIColor(rgb: light)
        })
    }
}

// MARK: - Design tokens

/// Central palette + type + motion tokens for the vibrant Pubster redesign.
/// Every color is adaptive so the whole app looks great in light AND dark.
enum Theme {
    // Surfaces & backgrounds — warmed to complement the Sunset palette
    static let bg = Color.adaptive(light: 0xFBF7F1, dark: 0x141210)
    static let surface = Color.adaptive(light: 0xFFFFFF, dark: 0x211C16)
    static let surfaceElevated = Color.adaptive(light: 0xFFFFFF, dark: 0x2B241B)
    static let hairline = Color.adaptive(light: 0xF0E9DE, dark: 0x3A3125)

    // Text
    static let textPrimary = Color.adaptive(light: 0x1A140D, dark: 0xF7F3EC)
    static let textSecondary = Color.adaptive(light: 0x877864, dark: 0xB7AB98)

    // Sunset accents — EA6113 / F88F22 / FBB931 / FFE3B3
    static let accent = Color.adaptive(light: 0xEA6113, dark: 0xF88F22)   // sunset orange
    static let magenta = Color.adaptive(light: 0xC2410C, dark: 0xFB923C)  // warm ember (chips)
    static let cyan = Color.adaptive(light: 0xB45309, dark: 0xFBB931)     // amber / gold

    // Motion
    static let cardSpring = Animation.spring(response: 0.45, dampingFraction: 0.82)
    static let carouselAdvance: TimeInterval = 4
}

extension Color {
    /// App-wide accent. Kept for source compatibility with the original design
    /// (used by many existing screens) — now the vibrant electric indigo.
    static let pubsterAccent = Theme.accent
}

// MARK: - Card styling

/// Rounded surface card: soft shadow in light, subtle elevation + hairline in dark.
struct CardStyle: ViewModifier {
    var cornerRadius: CGFloat = 22
    var padding: CGFloat? = nil

    func body(content: Content) -> some View {
        content
            .padding(padding ?? 0)
            .background(
                Theme.surface,
                in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(Theme.hairline, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.07), radius: 16, x: 0, y: 10)
    }
}

extension View {
    func cardStyle(cornerRadius: CGFloat = 22, padding: CGFloat? = nil) -> some View {
        modifier(CardStyle(cornerRadius: cornerRadius, padding: padding))
    }
}

// MARK: - Pills

/// A small rounded, tinted pill used for badges (distance, status, event chips).
/// Signature kept compatible with the original design so existing screens work.
struct PillLabel: View {
    let text: String
    var systemImage: String?
    var tint: Color = .pubsterAccent

    init(_ text: String, systemImage: String? = nil, tint: Color = .pubsterAccent) {
        self.text = text
        self.systemImage = systemImage
        self.tint = tint
    }

    var body: some View {
        HStack(spacing: 4) {
            if let systemImage {
                Image(systemName: systemImage)
            }
            Text(text)
        }
        .font(.system(.caption, design: .rounded).weight(.semibold))
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(tint.opacity(0.14), in: Capsule())
        .foregroundStyle(tint)
    }
}

/// A frosted, translucent glass pill — designed to sit on top of vivid gradients.
struct GlassPill: View {
    let text: String
    var systemImage: String?

    init(_ text: String, systemImage: String? = nil) {
        self.text = text
        self.systemImage = systemImage
    }

    var body: some View {
        HStack(spacing: 5) {
            if let systemImage {
                Image(systemName: systemImage)
            }
            Text(text)
        }
        .font(.system(.footnote, design: .rounded).weight(.semibold))
        .foregroundStyle(.white)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(.ultraThinMaterial.opacity(0.7), in: Capsule())
        .background(Color.white.opacity(0.12), in: Capsule())
        .overlay(
            Capsule().strokeBorder(Color.white.opacity(0.35), lineWidth: 1)
        )
    }
}
