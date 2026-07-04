import SwiftUI

struct ReserveView: View {
    let pub: PubDetailDTO
    let events: [EventDTO]

    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = ReserveViewModel()

    @State private var selectedSlot: AvailabilitySlotDTO?

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: Spacing.sm)]

    var body: some View {
        ZStack {
            ScreenBackground()
            if let confirmation = vm.confirmation {
                ConfirmationView(reservation: confirmation, pubName: pub.name) {
                    dismiss()
                }
            } else {
                form
            }
        }
        .navigationTitle("Reserve")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            if vm.confirmation == nil {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if vm.confirmation == nil, let slot = selectedSlot {
                confirmBar(for: slot)
            }
        }
    }

    private var form: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                SectionHeader("Book a table", subtitle: "at \(pub.name)")
                    .padding(.top, Spacing.xs)

                Card {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        HStack {
                            Label("Date", systemImage: "calendar")
                                .font(.pubLabel)
                                .foregroundStyle(Color.pubTextPrimary)
                            Spacer()
                            DatePicker("", selection: $vm.date, in: Date()..., displayedComponents: .date)
                                .labelsHidden()
                                .tint(.pubAccent)
                        }
                        Divider().overlay(Color.pubBorder)
                        VStack(spacing: Spacing.sm) {
                            Text("PARTY SIZE")
                                .font(.pubCaption)
                                .tracking(0.6)
                                .foregroundStyle(Color.pubTextSecondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            PartyStepper(count: $vm.partyCount)
                                .frame(maxWidth: .infinity)
                        }
                    }
                }

                SecondaryButton(title: "Find available tables",
                                systemImage: "magnifyingglass",
                                isLoading: vm.isLoadingSlots) {
                    selectedSlot = nil
                    Task { await vm.loadAvailability(api: appState.api, pubId: pub.id) }
                }

                if !events.isEmpty {
                    eventsSection
                }

                if let error = vm.errorMessage {
                    Text(error)
                        .font(.pubBody)
                        .foregroundStyle(Color.pubError)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if vm.hasSearched && !vm.isLoadingSlots {
                    slotsSection
                }
            }
            .padding(.horizontal, Spacing.screen)
            .padding(.bottom, Spacing.xxl)
        }
    }

    private var eventsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            SectionHeader("Join an event", subtitle: "Optional")
            VStack(spacing: Spacing.sm) {
                ForEach(events) { event in
                    let selected = vm.joinEventId == event.id
                    Button {
                        vm.joinEventId = selected ? nil : event.id
                    } label: {
                        HStack(alignment: .top, spacing: Spacing.md) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(event.name)
                                    .font(.pubBodyEmphasis)
                                    .foregroundStyle(Color.pubTextPrimary)
                                Text(DateUtils.dateTimeLabel(fromISO: event.startTime))
                                    .font(.pubCaption)
                                    .foregroundStyle(Color.pubTextSecondary)
                                Text(event.coverChargeCents > 0
                                     ? "\(Money.format(cents: event.coverChargeCents)) per person cover"
                                     : "Free entry")
                                    .font(.pubCaption)
                                    .foregroundStyle(Color.pubTextSecondary)
                            }
                            Spacer(minLength: Spacing.sm)
                            Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 22))
                                .foregroundStyle(selected ? Color.pubAccent : Color.pubTextSecondary.opacity(0.5))
                        }
                        .padding(Spacing.lg)
                        .background(
                            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                                .fill(Color.pubSurface)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                                .strokeBorder(selected ? Color.pubAccent : Color.pubBorder,
                                              lineWidth: selected ? 1.5 : 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private var slotsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            SectionHeader("Available times")
            if vm.availableSlots.isEmpty {
                Card {
                    Text("No tables available for this date and party size. Try another day or a smaller party.")
                        .font(.pubBody)
                        .foregroundStyle(Color.pubTextSecondary)
                }
            } else {
                LazyVGrid(columns: columns, spacing: Spacing.sm) {
                    ForEach(vm.slots) { slot in
                        SlotChip(
                            title: DateUtils.timeLabel(fromISO: slot.startTime),
                            subtitle: slot.seats.map { "\($0) seats" },
                            state: chipState(for: slot)
                        ) {
                            selectedSlot = slot
                        }
                    }
                }
            }
        }
    }

    private func chipState(for slot: AvailabilitySlotDTO) -> SlotChip.ChipState {
        if !slot.available { return .unavailable }
        return selectedSlot?.id == slot.id ? .selected : .available
    }

    private func confirmBar(for slot: AvailabilitySlotDTO) -> some View {
        VStack(spacing: Spacing.sm) {
            VStack(spacing: 2) {
                Text("\(DateUtils.timeLabel(fromISO: slot.startTime)) · Party of \(vm.partyCount)")
                    .font(.pubBodyEmphasis)
                    .foregroundStyle(Color.pubTextPrimary)
                Text(costSummary(for: slot))
                    .font(.pubCaption)
                    .foregroundStyle(Color.pubTextSecondary)
            }
            PrimaryButton(title: "Confirm reservation", systemImage: "checkmark", isLoading: vm.isBooking) {
                Task {
                    await vm.book(api: appState.api, pubId: pub.id, slot: slot, events: events)
                }
            }
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

    private func joinsEvent(for slot: AvailabilitySlotDTO) -> Bool {
        guard let id = vm.joinEventId, let event = events.first(where: { $0.id == id }) else { return false }
        return vm.event(event, overlaps: slot)
    }

    private func costSummary(for slot: AvailabilitySlotDTO) -> String {
        if joinsEvent(for: slot),
           let id = vm.joinEventId,
           let event = events.first(where: { $0.id == id }) {
            let cover = event.coverChargeCents * vm.partyCount
            return "Joining \(event.name) — \(Money.format(cents: cover)) cover at the pub"
        }
        return "Table reservation — free"
    }
}

/// Post-booking confirmation — celebratory.
private struct ConfirmationView: View {
    let reservation: ReservationDTO
    let pubName: String
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: Spacing.xl) {
            Spacer()
            ZStack {
                Circle()
                    .fill(LinearGradient.pubAccentGradient)
                    .frame(width: 104, height: 104)
                    .softShadow(radius: 18, y: 8, opacity: 0.20)
                Image(systemName: "checkmark")
                    .font(.system(size: 46, weight: .bold))
                    .foregroundStyle(.white)
            }
            VStack(spacing: Spacing.xs) {
                Text("Table booked!")
                    .font(.pubDisplay)
                    .foregroundStyle(Color.pubEspresso)
                Text("We've saved your spot.")
                    .font(.pubBody)
                    .foregroundStyle(Color.pubTextSecondary)
            }

            Card {
                VStack(spacing: Spacing.md) {
                    SummaryRow(label: "Pub", value: reservation.pubName ?? pubName)
                    Divider().overlay(Color.pubBorder)
                    SummaryRow(label: "When", value: DateUtils.dateTimeLabel(fromISO: reservation.startTime))
                    Divider().overlay(Color.pubBorder)
                    SummaryRow(label: "Party", value: "\(reservation.partyCount) guest\(reservation.partyCount == 1 ? "" : "s")")
                    Divider().overlay(Color.pubBorder)
                    SummaryRow(label: "Table", value: "\(reservation.seats) seats")
                    Divider().overlay(Color.pubBorder)
                    HStack {
                        Text("Status")
                            .font(.pubLabel)
                            .foregroundStyle(Color.pubTextSecondary)
                        Spacer()
                        PillLabel(reservation.status.rawValue.capitalized,
                                  systemImage: "checkmark.seal.fill", tint: .pubSuccess)
                    }
                }
            }

            Spacer()
            PrimaryButton(title: "Done", action: onDone)
        }
        .padding(Spacing.xxl)
    }
}

private struct SummaryRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.pubLabel)
                .foregroundStyle(Color.pubTextSecondary)
            Spacer(minLength: Spacing.lg)
            Text(value)
                .font(.pubBodyEmphasis)
                .foregroundStyle(Color.pubTextPrimary)
                .multilineTextAlignment(.trailing)
        }
    }
}
