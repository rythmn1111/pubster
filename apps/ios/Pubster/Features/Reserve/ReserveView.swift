import SwiftUI

struct ReserveView: View {
    let pub: PubDetailDTO
    let events: [EventDTO]

    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = ReserveViewModel()

    @State private var pendingSlot: AvailabilitySlotDTO?

    var body: some View {
        Group {
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
        .toolbar {
            if vm.confirmation == nil {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var form: some View {
        Form {
            Section("When") {
                DatePicker(
                    "Date",
                    selection: $vm.date,
                    in: Date()...,
                    displayedComponents: .date
                )
                Stepper("Party of \(vm.partyCount)", value: $vm.partyCount, in: 1...20)
            }

            Section {
                Button {
                    Task { await vm.loadAvailability(api: appState.api, pubId: pub.id) }
                } label: {
                    HStack {
                        Text("Check availability")
                        Spacer()
                        if vm.isLoadingSlots { ProgressView() }
                    }
                }
                .disabled(vm.isLoadingSlots)
            }

            if !events.isEmpty {
                eventsSection
            }

            if let error = vm.errorMessage {
                Section {
                    Text(error).foregroundStyle(.red).font(.subheadline)
                }
            }

            if vm.hasSearched && !vm.isLoadingSlots {
                slotsSection
            }
        }
        .confirmationDialog(
            "Confirm reservation",
            isPresented: Binding(
                get: { pendingSlot != nil },
                set: { if !$0 { pendingSlot = nil } }
            ),
            titleVisibility: .visible,
            presenting: pendingSlot
        ) { slot in
            Button("Book \(DateUtils.timeLabel(fromISO: slot.startTime)) for \(vm.partyCount)") {
                Task {
                    await vm.book(api: appState.api, pubId: pub.id, slot: slot, events: events)
                    pendingSlot = nil
                }
            }
            Button("Cancel", role: .cancel) { pendingSlot = nil }
        } message: { slot in
            Text(summaryMessage(for: slot))
        }
    }

    private var eventsSection: some View {
        Section("Join an event (optional)") {
            ForEach(events) { event in
                Button {
                    if vm.joinEventId == event.id {
                        vm.joinEventId = nil
                    } else {
                        vm.joinEventId = event.id
                    }
                } label: {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.name).font(.body.weight(.semibold))
                            Text(DateUtils.dateTimeLabel(fromISO: event.startTime))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(event.coverChargeCents > 0
                                 ? "\(Money.format(cents: event.coverChargeCents)) per person cover"
                                 : "Free entry")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: vm.joinEventId == event.id ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(vm.joinEventId == event.id ? Color.pubsterAccent : Color.secondary)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var slotsSection: some View {
        if vm.availableSlots.isEmpty {
            Section("Available times") {
                Text("No tables available for this date and party size. Try another day or a smaller party.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        } else {
            Section("Available times") {
                ForEach(vm.availableSlots) { slot in
                    Button {
                        pendingSlot = slot
                    } label: {
                        HStack {
                            Text(DateUtils.timeLabel(fromISO: slot.startTime))
                                .font(.body.weight(.medium))
                            if let seats = slot.seats {
                                PillLabel("\(seats)-seat", systemImage: "chair.lounge.fill")
                            }
                            Spacer()
                            if joinsEvent(for: slot) {
                                PillLabel("Event", systemImage: "ticket.fill")
                            }
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private func joinsEvent(for slot: AvailabilitySlotDTO) -> Bool {
        guard let id = vm.joinEventId, let event = events.first(where: { $0.id == id }) else { return false }
        return vm.event(event, overlaps: slot)
    }

    private func summaryMessage(for slot: AvailabilitySlotDTO) -> String {
        var lines = [
            "\(pub.name)",
            "\(DateUtils.dateTimeLabel(fromISO: slot.startTime)) · party of \(vm.partyCount)",
        ]
        if joinsEvent(for: slot),
           let id = vm.joinEventId,
           let event = events.first(where: { $0.id == id }) {
            let cover = event.coverChargeCents * vm.partyCount
            lines.append("Joining \(event.name) — \(Money.format(cents: cover)) cover (billed at the pub)")
        } else {
            lines.append("Table reservation — free")
        }
        return lines.joined(separator: "\n")
    }
}

/// Post-booking confirmation.
private struct ConfirmationView: View {
    let reservation: ReservationDTO
    let pubName: String
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 72))
                .foregroundStyle(.green)
            Text("You're booked!")
                .font(.title.bold())

            VStack(spacing: 8) {
                Text(reservation.pubName ?? pubName)
                    .font(.headline)
                Text(DateUtils.dateTimeLabel(fromISO: reservation.startTime))
                    .foregroundStyle(.secondary)
                HStack(spacing: 8) {
                    PillLabel("Party of \(reservation.partyCount)", systemImage: "person.2.fill")
                    PillLabel("\(reservation.seats)-seat table", systemImage: "chair.lounge.fill")
                    PillLabel(reservation.status.rawValue.capitalized, systemImage: "checkmark.seal.fill", tint: .green)
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))

            Spacer()
            PrimaryButton(title: "Done", action: onDone)
        }
        .padding(24)
    }
}
