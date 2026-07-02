import SwiftUI

struct PubDetailView: View {
    let pubId: String
    let pubName: String

    @EnvironmentObject private var appState: AppState
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
        Group {
            if vm.isLoading && vm.detail == nil {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = vm.errorMessage, vm.detail == nil {
                ContentUnavailableView {
                    Label("Couldn't load pub", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Try again") { Task { await vm.load(api: appState.api, pubId: pubId) } }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                loaded
            }
        }
        .navigationTitle(vm.detail?.name ?? pubName)
        .navigationBarTitleDisplayMode(.inline)
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

    private var loaded: some View {
        VStack(spacing: 0) {
            Picker("Section", selection: $tab) {
                ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding()

            ScrollView {
                switch tab {
                case .info: infoSection
                case .menu: menuSection
                case .events: eventsSection
                }
            }
        }
    }

    // MARK: - Info

    @ViewBuilder
    private var infoSection: some View {
        if let detail = vm.detail {
            VStack(alignment: .leading, spacing: 20) {
                if let description = detail.description, !description.isEmpty {
                    Text(description).font(.body)
                }
                if !detail.fullAddress.isEmpty {
                    InfoRow(icon: "mappin.and.ellipse", title: "Address", value: detail.fullAddress)
                }
                if let phone = detail.phone, !phone.isEmpty {
                    InfoRow(icon: "phone.fill", title: "Phone", value: phone)
                }
                InfoRow(icon: "clock.fill", title: "Reservation slot", value: "\(detail.slotMinutes) minutes")
                if let hours = detail.openingHours, !hours.isEmpty {
                    OpeningHoursView(hours: hours)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
    }

    // MARK: - Menu

    @ViewBuilder
    private var menuSection: some View {
        if vm.menu.isEmpty {
            ContentUnavailableView("No menu yet", systemImage: "fork.knife")
                .padding(.top, 40)
        } else {
            VStack(alignment: .leading, spacing: 24) {
                ForEach(vm.menu) { category in
                    VStack(alignment: .leading, spacing: 12) {
                        Text(category.name)
                            .font(.title3.bold())
                        ForEach(category.items) { item in
                            MenuItemRow(item: item)
                            if item.id != category.items.last?.id {
                                Divider()
                            }
                        }
                    }
                }
            }
            .padding()
        }
    }

    // MARK: - Events

    @ViewBuilder
    private var eventsSection: some View {
        if vm.events.isEmpty {
            ContentUnavailableView("No upcoming events", systemImage: "calendar.badge.exclamationmark")
                .padding(.top, 40)
        } else {
            VStack(spacing: 16) {
                ForEach(vm.events) { event in
                    EventCard(event: event)
                }
            }
            .padding()
        }
    }

    private var reserveBar: some View {
        PrimaryButton(title: "Reserve a table") {
            showReserve = true
        }
        .padding()
        .background(.thinMaterial)
    }
}

// MARK: - Subviews

private struct InfoRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Color.pubsterAccent)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(value).font(.body).foregroundStyle(.secondary)
            }
        }
    }
}

private struct MenuItemRow: View {
    let item: MenuItemDTO

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text(item.name).font(.body.weight(.semibold))
                if let description = item.description, !description.isEmpty {
                    Text(description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if !item.isAvailable {
                    Text("Currently unavailable")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            Spacer()
            Text(Money.format(cents: item.priceCents))
                .font(.body.weight(.semibold).monospacedDigit())
        }
    }
}

private struct EventCard: View {
    let event: EventDTO

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(event.name).font(.headline)
                Spacer()
                if event.coverChargeCents > 0 {
                    PillLabel("\(Money.format(cents: event.coverChargeCents)) cover", systemImage: "ticket.fill")
                } else {
                    PillLabel("Free", systemImage: "ticket.fill")
                }
            }
            Label(DateUtils.dateTimeLabel(fromISO: event.startTime), systemImage: "calendar")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if let description = event.description, !description.isEmpty {
                Text(description).font(.subheadline)
            }
            Text("Capacity: \(event.capacity)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct OpeningHoursView: View {
    let hours: OpeningHours

    private let order: [(key: String, label: String)] = [
        ("mon", "Monday"), ("tue", "Tuesday"), ("wed", "Wednesday"),
        ("thu", "Thursday"), ("fri", "Friday"), ("sat", "Saturday"), ("sun", "Sunday"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Opening hours", systemImage: "clock")
                .font(.subheadline.weight(.semibold))
            ForEach(order, id: \.key) { day in
                HStack {
                    Text(day.label)
                        .frame(width: 100, alignment: .leading)
                    Text(rangeText(for: day.key))
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .font(.subheadline)
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
