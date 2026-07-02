import SwiftUI

extension Color {
    /// Warm amber — the Pubster accent (matches the `AccentColor` asset).
    static let pubsterAccent = Color(red: 0.85, green: 0.52, blue: 0.10)
}

/// A small rounded pill used for badges (distance, status, "event tonight").
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
        .font(.caption.weight(.semibold))
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(tint.opacity(0.15), in: Capsule())
        .foregroundStyle(tint)
    }
}
