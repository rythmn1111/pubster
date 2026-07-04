import SwiftUI

struct PubDetailView: View {
    let pubId: String
    let pubName: String

    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = PubDetailViewModel()

    enum Tab: String, CaseIterable, Identifiable {
        case info = "Info"
        case menu = "Menu"
        case events = "Events"
        var id: String { rawValue }
    }

    @State private var tab: Tab = .info
    @State private var showReserve = false

    var body: some View {
        ZStack {
            ScreenBackground()
            content
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.pubEspresso)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(.thinMaterial))
                        .overlay(Circle().strokeBorder(Color.white.opacity(0.4), lineWidth: 1))
                }
                .accessibilityLabel("Back")
            }
        }
        .safeAreaInset(edge: .bottom) {
            if vm.detail != nil {
                reserveBar
            }
        }
        .sheet(isPresented: $showReserve) {
            if let detail = vm.detail {
                NavigationStack {
                    ReserveView(pub: detail, events: vm.events)
                }
            }
        }
        .task { await vm.load(api: appState.api, pubId: pubId) }
    }

    @ViewBuilder
    private var content: some View {
        if vm.isLoading && vm.detail == nil {
            LoadingStateView(message: "Loading pub…")
        } else if let error = vm.errorMessage, vm.detail == nil {
            EmptyStateView(
                icon: "exclamationmark.triangle",
                title: "Couldn't load pub",
                message: error,
                actionTitle: "Try again",
                action: { Task { await vm.load(api: appState.api, pubId: pubId) } }
            )
        } else {
            loaded
        }
    }

    private var loaded: some View {
        VStack(spacing: 0) {
            if let detail = vm.detail {
                hero(detail)
            }
            SegmentedPicker(options: Tab.allCases, title: { $0.rawValue }, selection: $tab)
                .padding(.horizontal, Spacing.screen)
                .padding(.vertical, Spacing.md)

            ScrollView {
                Group {
                    switch tab {
                    case .info: infoSection
                    case .menu: menuSection
                    case .events: eventsSection
                    }
                }
                .padding(.horizontal, Spacing.screen)
                .padding(.bottom, Spacing.xxl)
            }
        }
    }

    // MARK: - Hero

    private func hero(_ detail: PubDetailDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Image(systemName: "mug.fill")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(.white.opacity(0.85))
            Text(detail.name)
                .font(.pubDisplay)
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
            if !detail.fullAddress.isEmpty {
                Label(detail.fullAddress, systemImage: "mappin.and.ellipse")
                    .font(.pubBody)
                    .foregroundStyle(.white.opacity(0.9))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.screen)
        .padding(.top, Spacing.sm)
        .padding(.bottom, Spacing.xl)
        .background(
            LinearGradient.pubHeroGradient
                .ignoresSafeArea(edges: .top)
        )
    }

    // MARK: - Info

    @ViewBuilder
    private var infoSection: some View {
        if let detail = vm.detail {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                if let description = detail.description, !description.isEmpty {
                    Card {
                        Text(description)
                            .font(.pubBody)
                            .foregroundStyle(Color.pubTextPrimary)
                    }
                }
                Card {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        if !detail.fullAddress.isEmpty {
                            InfoRow(icon: "mappin.and.ellipse", title: "Address", value: detail.fullAddress)
                        }
                        if let phone = detail.phone, !phone.isEmpty {
                            InfoRow(icon: "phone.fill", title: "Phone", value: phone)
                        }
                        InfoRow(icon: "clock.fill", title: "Reservation slot", value: "\(detail.slotMinutes) minutes")
                    }
                }
                if let hours = detail.openingHours, !hours.isEmpty {
                    Card {
                        OpeningHoursView(hours: hours)
                    }
                }
            }
            .padding(.top, Spacing.lg)
        }
    }

    // MARK: - Menu

    @ViewBuilder
    private var menuSection: some View {
        if vm.menu.isEmpty {
            EmptyStateView(icon: "fork.knife", title: "No menu yet",
                           message: "This pub hasn't shared its menu.")
                .padding(.top, Spacing.xxl)
        } else {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                ForEach(vm.menu) { category in
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        SectionHeader(category.name)
                        Card(padding: Spacing.lg) {
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                ForEach(category.items) { item in
                                    MenuItemRow(item: item)
                                    if item.id != category.items.last?.id {
                                        Divider().overlay(Color.pubBorder)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding(.top, Spacing.lg)
        }
    }

    // MARK: - Events

    @ViewBuilder
    private var eventsSection: some View {
        if vm.events.isEmpty {
            EmptyStateView(icon: "calendar.badge.exclamationmark", title: "No upcoming events",
                           message: "Check back soon for what's on.")
                .padding(.top, Spacing.xxl)
        } else {
            VStack(spacing: Spacing.md) {
                ForEach(vm.events) { event in
                    EventCard(event: event)
                }
            }
            .padding(.top, Spacing.lg)
        }
    }

    private var reserveBar: some View {
        PrimaryButton(title: "Reserve a table", systemImage: "calendar.badge.plus") {
            showReserve = true
        }
        .padding(.horizontal, Spacing.screen)
        .padding(.top, Spacing.md)
        .padding(.bottom, Spacing.sm)
        .background(
            Color.pubSurface
                .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.pubBorder), alignment: .top)
                .ignoresSafeArea(edges: .bottom)
        )
    }
}

// MARK: - Subviews

private struct InfoRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.pubAccent)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.pubLabel)
                    .foregroundStyle(Color.pubTextPrimary)
                Text(value)
                    .font(.pubBody)
                    .foregroundStyle(Color.pubTextSecondary)
            }
        }
    }
}

private struct MenuItemRow: View {
    let item: MenuItemDTO

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 3) {
                Text(item.name)
                    .font(.pubBodyEmphasis)
                    .foregroundStyle(Color.pubTextPrimary)
                if let description = item.description, !description.isEmpty {
                    Text(description)
                        .font(.pubCaption)
                        .foregroundStyle(Color.pubTextSecondary)
                }
                if !item.isAvailable {
                    Text("Currently unavailable")
                        .font(.pubCaption)
                        .foregroundStyle(Color.pubError)
                }
            }
            Spacer(minLength: Spacing.sm)
            Text(Money.format(cents: item.priceCents))
                .font(.pubBodyEmphasis.monospacedDigit())
                .foregroundStyle(Color.pubAccent)
        }
    }
}

private struct EventCard: View {
    let event: EventDTO

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(alignment: .top) {
                    Text(event.name)
                        .font(.pubHeadline)
                        .foregroundStyle(Color.pubEspresso)
                    Spacer(minLength: Spacing.sm)
                    if event.coverChargeCents > 0 {
                        PillLabel("\(Money.format(cents: event.coverChargeCents)) cover", systemImage: "ticket.fill", tint: .pubGold)
                    } else {
                        PillLabel("Free", systemImage: "ticket.fill", tint: .pubSuccess)
                    }
                }
                Label(DateUtils.dateTimeLabel(fromISO: event.startTime), systemImage: "calendar")
                    .font(.pubBody)
                    .foregroundStyle(Color.pubTextSecondary)
                if let description = event.description, !description.isEmpty {
                    Text(description)
                        .font(.pubBody)
                        .foregroundStyle(Color.pubTextPrimary)
                }
                Text("Capacity: \(event.capacity)")
                    .font(.pubCaption)
                    .foregroundStyle(Color.pubTextSecondary)
            }
        }
    }
}

private struct OpeningHoursView: View {
    let hours: OpeningHours

    private let order: [(key: String, label: String)] = [
        ("mon", "Monday"), ("tue", "Tuesday"), ("wed", "Wednesday"),
        ("thu", "Thursday"), ("fri", "Friday"), ("sat", "Saturday"), ("sun", "Sunday"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Label("Opening hours", systemImage: "clock")
                .font(.pubLabel)
                .foregroundStyle(Color.pubTextPrimary)
            ForEach(order, id: \.key) { day in
                HStack {
                    Text(day.label)
                        .frame(width: 100, alignment: .leading)
                        .foregroundStyle(Color.pubTextPrimary)
                    Text(rangeText(for: day.key))
                        .foregroundStyle(Color.pubTextSecondary)
                    Spacer()
                }
                .font(.pubBody)
            }
        }
    }

    private func rangeText(for key: String) -> String {
        guard let ranges = hours[key], !ranges.isEmpty else { return "Closed" }
        return ranges
            .compactMap { $0.count >= 2 ? "\($0[0])–\($0[1])" : nil }
            .joined(separator: ", ")
    }
}

extension PubDetailDTO {
    var fullAddress: String {
        [addressLine, city, region, postalCode].compactMap { $0 }.joined(separator: ", ")
    }
}
