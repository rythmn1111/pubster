import SwiftUI

// MARK: - Design tokens
//
// Pubster's "warm pub / cozy" design system. Everything visual funnels through
// these tokens (palette, typography, spacing, radii, shadows) and the reusable
// components in DesignSystem.swift — no one-off styles in the feature views.
//
// Colours are intentionally fixed (not asset-catalog / semantic) so the warm
// cream aesthetic reads consistently; dark mode keeps the same legible palette
// rather than inverting to something muddy.

// MARK: Palette

extension Color {
    /// Hex convenience, e.g. `Color(hex: 0xC1741A)`.
    init(hex: UInt32) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }

    // Backgrounds & surfaces
    static let pubBackgroundTop = Color(hex: 0xFBF6ED)   // warm cream (top of gradient)
    static let pubBackgroundBottom = Color(hex: 0xF4E9D6) // deeper cream (bottom)
    static let pubSurface = Color(hex: 0xFFFDF9)          // cards / fields
    static let pubBorder = Color(hex: 0xEAD9BF)           // hairline border

    // Accent — amber ale
    static let pubAccent = Color(hex: 0xC1741A)
    static let pubAccentDark = Color(hex: 0xA85F12)       // gradients / pressed
    static let pubGold = Color(hex: 0xE0A93F)             // gold highlight

    // Text & headings
    static let pubEspresso = Color(hex: 0x3A2A1C)         // dark headings / hero
    static let pubTextPrimary = Color(hex: 0x241A12)
    static let pubTextSecondary = Color(hex: 0x857361)

    // Semantic
    static let pubSuccess = Color(hex: 0x4C7A4E)
    static let pubError = Color(hex: 0xB4472E)

    /// Legacy alias — kept so any older reference keeps compiling. Now the amber ale.
    static let pubsterAccent = Color(hex: 0xC1741A)
}

// MARK: Gradients

extension LinearGradient {
    /// Cream screen background.
    static let pubBackgroundGradient = LinearGradient(
        colors: [.pubBackgroundTop, .pubBackgroundBottom],
        startPoint: .top, endPoint: .bottom
    )
    /// Amber → darker amber, for primary buttons and selected chips.
    static let pubAccentGradient = LinearGradient(
        colors: [.pubAccent, .pubAccentDark],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    /// Amber → espresso, for hero headers and pub thumbnails.
    static let pubHeroGradient = LinearGradient(
        colors: [.pubAccent, .pubEspresso],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
}

// MARK: Typography
//
// System SERIF for display titles & pub names; rounded for body/labels/buttons.

extension Font {
    static let pubDisplay = Font.system(size: 32, weight: .bold, design: .serif)
    static let pubTitle = Font.system(size: 26, weight: .bold, design: .serif)
    static let pubHeadline = Font.system(size: 20, weight: .semibold, design: .serif)
    static let pubBody = Font.system(size: 16, weight: .regular, design: .rounded)
    static let pubBodyEmphasis = Font.system(size: 16, weight: .semibold, design: .rounded)
    static let pubLabel = Font.system(size: 14, weight: .semibold, design: .rounded)
    static let pubCaption = Font.system(size: 12.5, weight: .medium, design: .rounded)
    static let pubButton = Font.system(size: 17, weight: .semibold, design: .rounded)
}

// MARK: Spacing & radii

enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
    /// Default horizontal screen padding.
    static let screen: CGFloat = 20
}

enum Radius {
    static let card: CGFloat = 20
    static let button: CGFloat = 16
    static let field: CGFloat = 14
    static let chip: CGFloat = 12
}

// MARK: Soft warm shadow

extension View {
    /// Soft warm drop shadow used on cards, buttons and thumbnails.
    func softShadow(radius: CGFloat = 14, y: CGFloat = 7, opacity: Double = 0.08) -> some View {
        shadow(color: Color.black.opacity(opacity), radius: radius, x: 0, y: y)
    }
}
