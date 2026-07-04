import SwiftUI

// MARK: - Event gradients

/// A small rotating set of bold, vivid gradients used for event hero cards.
/// Gradients read great in both light and dark, so they're intentionally the
/// same in both appearances.
enum EventGradient {
    /// [top-leading color, bottom-trailing color]
    static let palette: [[Color]] = [
        [Color(rgb: 0xEA6113), Color(rgb: 0xFBB931)],                        // deep orange → gold
        [Color(rgb: 0xEA6113), Color(rgb: 0xF88F22), Color(rgb: 0xFFE3B3)],  // full sunset
        [Color(rgb: 0xF88F22), Color(rgb: 0xFFE3B3)],                        // orange → cream
        [Color(rgb: 0xE0450A), Color(rgb: 0xFBB931)],                        // ember → gold
        [Color(rgb: 0xF88F22), Color(rgb: 0xFBB931)],                        // orange → amber
    ]

    static func colors(_ index: Int) -> [Color] {
        palette[((index % palette.count) + palette.count) % palette.count]
    }

    static func linear(_ index: Int) -> LinearGradient {
        LinearGradient(colors: colors(index), startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    /// Primary hue for shadows/CTA tinting.
    static func primary(_ index: Int) -> Color {
        colors(index).first ?? Theme.accent
    }
}

// MARK: - Section header

/// A styled section header with a large, expressive rounded title.
struct SectionHeader: View {
    let title: String
    var subtitle: String?
    var systemImage: String?

    init(_ title: String, subtitle: String? = nil, systemImage: String? = nil) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
    }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.system(.title3, design: .rounded).weight(.bold))
                    .foregroundStyle(Theme.accent)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(.title2, design: .rounded).weight(.bold))
                    .foregroundStyle(Theme.textPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Shimmer / skeleton

/// A subtle left-to-right shimmer used for skeleton loading states.
struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geo in
                    LinearGradient(
                        colors: [.clear, Color.white.opacity(0.28), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geo.size.width * 1.4)
                    .offset(x: phase * geo.size.width * 1.4)
                }
                .mask(content)
                .allowsHitTesting(false)
            )
            .onAppear {
                withAnimation(.linear(duration: 1.15).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

extension View {
    func shimmering() -> some View { modifier(Shimmer()) }
}

/// A rounded skeleton placeholder block.
struct SkeletonBlock: View {
    var cornerRadius: CGFloat = 12
    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(Theme.hairline)
            .shimmering()
    }
}

// MARK: - Pub card

/// A modern, tappable pub card with a gradient thumbnail, distance, and an
/// optional accent chip when the pub has an upcoming event.
struct PubCard: View {
    let pub: PubSummaryDTO
    var gradientIndex: Int = 0
    var hasEvent: Bool = false

    var body: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(EventGradient.linear(gradientIndex))
                .frame(width: 58, height: 58)
                .overlay(
                    Image(systemName: "mug.fill")
                        .font(.title3)
                        .foregroundStyle(.white)
                )
                .shadow(color: EventGradient.primary(gradientIndex).opacity(0.35), radius: 8, x: 0, y: 5)

            VStack(alignment: .leading, spacing: 6) {
                Text(pub.name)
                    .font(.system(.headline, design: .rounded).weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                if !pub.shortAddress.isEmpty {
                    Text(pub.shortAddress)
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)
                }
                HStack(spacing: 6) {
                    PillLabel(pub.distanceLabel, systemImage: "location.fill", tint: Theme.accent)
                    if hasEvent {
                        PillLabel("Event tonight", systemImage: "sparkles", tint: Theme.magenta)
                    }
                }
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.footnote.weight(.bold))
                .foregroundStyle(Theme.textSecondary.opacity(0.6))
        }
        .padding(14)
        .cardStyle(cornerRadius: 20)
    }
}

// MARK: - Event carousel slide

/// A full-bleed, vivid gradient slide for the top Discover carousel.
struct EventSlide: View {
    let featured: FeaturedEvent

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            EventGradient.linear(featured.gradientIndex)

            // Decorative translucent orbs for depth.
            Circle()
                .fill(Color.white.opacity(0.14))
                .frame(width: 190)
                .offset(x: 130, y: -70)
            Circle()
                .fill(Color.white.opacity(0.10))
                .frame(width: 130)
                .offset(x: -100, y: 80)

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    GlassPill("Nearby · \(featured.pub.distanceLabel)", systemImage: "location.fill")
                    Spacer()
                    GlassPill(featured.coverLabel, systemImage: "ticket.fill")
                }
                Spacer(minLength: 12)
                Text(featured.event.name)
                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .shadow(color: .black.opacity(0.18), radius: 6, y: 2)
                HStack(spacing: 6) {
                    Image(systemName: "mappin.circle.fill")
                    Text(featured.pub.name)
                        .lineLimit(1)
                }
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(.white.opacity(0.95))
                .padding(.top, 6)
                HStack(spacing: 6) {
                    Image(systemName: "calendar")
                    Text(DateUtils.dateTimeLabel(fromISO: featured.event.startTime))
                }
                .font(.footnote.weight(.medium))
                .foregroundStyle(.white.opacity(0.9))
                .padding(.top, 3)
            }
            .padding(22)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .shadow(color: EventGradient.primary(featured.gradientIndex).opacity(0.35), radius: 20, x: 0, y: 14)
    }
}

// MARK: - Page dots

/// Custom paging dots — the active one stretches into an accent capsule.
struct PageDots: View {
    let count: Int
    let index: Int

    var body: some View {
        HStack(spacing: 7) {
            ForEach(0..<count, id: \.self) { i in
                Capsule()
                    .fill(i == index ? Theme.accent : Theme.textSecondary.opacity(0.3))
                    .frame(width: i == index ? 22 : 7, height: 7)
            }
        }
        .animation(Theme.cardSpring, value: index)
    }
}
