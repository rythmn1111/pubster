import SwiftUI

/// Bold, vivid Event Detail screen. Pushed onto the Discover navigation stack,
/// so its "Reserve & join" CTA can navigate straight into the existing
/// pub-detail / reserve flow. Full light + dark support.
struct EventDetailView: View {
    let featured: FeaturedEvent

    @Environment(\.dismiss) private var dismiss

    private var event: EventDTO { featured.event }
    private var pub: PubSummaryDTO { featured.pub }

    var body: some View {
        ZStack(alignment: .top) {
            Theme.bg.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    hero
                    details
                }
            }
            .ignoresSafeArea(edges: .top)
            .scrollIndicators(.hidden)

            backButton
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 16)
                .padding(.top, 4)
        }
        .safeAreaInset(edge: .bottom) { ctaBar }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
    }

    // MARK: - Hero

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            EventGradient.linear(featured.gradientIndex)

            Circle().fill(Color.white.opacity(0.14)).frame(width: 210).offset(x: 150, y: -90)
            Circle().fill(Color.white.opacity(0.10)).frame(width: 150).offset(x: -110, y: 70)

            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    GlassPill(shortDate, systemImage: "calendar")
                    GlassPill(featured.coverLabel, systemImage: "ticket.fill")
                }
                Spacer(minLength: 16)
                Text(event.name)
                    .font(.system(size: 38, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(3)
                    .minimumScaleFactor(0.8)
                    .shadow(color: .black.opacity(0.2), radius: 8, y: 3)
                HStack(spacing: 6) {
                    Image(systemName: "mappin.circle.fill")
                    Text(pub.name)
                }
                .font(.system(.headline, design: .rounded).weight(.semibold))
                .foregroundStyle(.white.opacity(0.95))
            }
            .padding(.horizontal, 22)
            .padding(.top, 112)
            .padding(.bottom, 26)
        }
        .frame(height: 360)
    }

    // MARK: - Details

    private var details: some View {
        VStack(alignment: .leading, spacing: 22) {
            statRow

            if !pub.shortAddress.isEmpty {
                infoCard(
                    icon: "mappin.and.ellipse",
                    title: pub.name,
                    value: pub.shortAddress
                )
            }

            if let description = event.description, !description.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader("About this event")
                    Text(description)
                        .font(.body)
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 22)
        .padding(.bottom, 8)
    }

    private var statRow: some View {
        HStack(spacing: 12) {
            statCard(icon: "clock.fill", label: "Starts", value: timeOnly)
            statCard(icon: "ticket.fill", label: "Cover",
                     value: Money.compact(cents: event.coverChargeCents))
            statCard(icon: "person.2.fill", label: "Capacity", value: "\(event.capacity)")
        }
    }

    private func statCard(icon: String, label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .font(.headline)
                .foregroundStyle(Theme.accent)
            Text(value)
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .cardStyle(cornerRadius: 18)
    }

    private func infoCard(icon: String, title: String, value: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(Theme.accent)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(.headline, design: .rounded).weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                Text(value)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .cardStyle(cornerRadius: 18)
    }

    // MARK: - CTA

    private var ctaBar: some View {
        VStack(spacing: 0) {
            Divider().overlay(Theme.hairline)
            NavigationLink(value: DiscoverRoute.pub(id: pub.id, name: pub.name)) {
                HStack(spacing: 8) {
                    Image(systemName: "ticket.fill")
                    Text("Reserve & join")
                }
                .font(.system(.headline, design: .rounded).weight(.bold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    EventGradient.linear(featured.gradientIndex),
                    in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                )
                .shadow(color: EventGradient.primary(featured.gradientIndex).opacity(0.4), radius: 14, x: 0, y: 8)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 8)
        }
        .background(.bar)
    }

    // MARK: - Back button

    private var backButton: some View {
        Button {
            dismiss()
        } label: {
            Image(systemName: "chevron.left")
                .font(.headline.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(.ultraThinMaterial.opacity(0.7), in: Circle())
                .background(Color.white.opacity(0.12), in: Circle())
                .overlay(Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 1))
        }
    }

    // MARK: - Formatting

    private var shortDate: String {
        let full = DateUtils.dateTimeLabel(fromISO: event.startTime)
        // "EEE, MMM d · h:mm a" -> keep the date part only for the top pill.
        return full.components(separatedBy: " · ").first ?? full
    }

    private var timeOnly: String {
        DateUtils.timeLabel(fromISO: event.startTime)
    }
}
