import SwiftUI

@MainActor
final class MyBookingsViewModel: ObservableObject {
    @Published var reservations: [ReservationDTO] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var cancellingIds: Set<String> = []

    var upcoming: [ReservationDTO] {
        reservations
            .filter { isUpcoming($0) }
            .sorted { $0.startTime < $1.startTime }
    }

    var past: [ReservationDTO] {
        reservations
            .filter { !isUpcoming($0) }
            .sorted { $0.startTime > $1.startTime }
    }

    private func isUpcoming(_ reservation: ReservationDTO) -> Bool {
        guard reservation.status != .cancelled, reservation.status != .completed else { return false }
        guard let start = DateUtils.date(fromISO: reservation.startTime) else { return true }
        return start >= Date()
    }

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            reservations = try await api.myReservations()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func cancel(api: APIClient, reservation: ReservationDTO) async {
        cancellingIds.insert(reservation.id)
        defer { cancellingIds.remove(reservation.id) }
        do {
            let updated = try await api.cancelReservation(id: reservation.id)
            if let index = reservations.firstIndex(where: { $0.id == updated.id }) {
                reservations[index] = updated
            }
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}

struct MyBookingsView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = MyBookingsViewModel()

    var body: some View {
        Group {
            if vm.isLoading && vm.reservations.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = vm.errorMessage, vm.reservations.isEmpty {
                ContentUnavailableView {
                    Label("Couldn't load bookings", systemImage: "calendar.badge.exclamationmark")
                } description: {
                    Text(error)
                } actions: {
                    Button("Try again") { Task { await vm.load(api: appState.api) } }
                        .buttonStyle(.borderedProminent)
                }
            } else if vm.reservations.isEmpty {
                ContentUnavailableView(
                    "No bookings yet",
                    systemImage: "calendar",
                    description: Text("Reserve a table and it'll show up here.")
                )
            } else {
                list
            }
        }
        .navigationTitle("My Bookings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { dismiss() }
            }
        }
        .task { await vm.load(api: appState.api) }
    }

    private var list: some View {
        List {
            if !vm.upcoming.isEmpty {
                Section("Upcoming") {
                    ForEach(vm.upcoming) { reservation in
                        BookingRow(
                            reservation: reservation,
                            isCancelling: vm.cancellingIds.contains(reservation.id),
                            canCancel: true
                        ) {
                            Task { await vm.cancel(api: appState.api, reservation: reservation) }
                        }
                    }
                }
            }
            if !vm.past.isEmpty {
                Section("Past & cancelled") {
                    ForEach(vm.past) { reservation in
                        BookingRow(reservation: reservation, isCancelling: false, canCancel: false, onCancel: {})
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await vm.load(api: appState.api) }
    }
}

private struct BookingRow: View {
    let reservation: ReservationDTO
    let isCancelling: Bool
    let canCancel: Bool
    let onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(reservation.pubName ?? "Pub")
                    .font(.headline)
                Spacer()
                StatusBadge(status: reservation.status)
            }
            Label(DateUtils.dateTimeLabel(fromISO: reservation.startTime), systemImage: "calendar")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                PillLabel("Party of \(reservation.partyCount)", systemImage: "person.2.fill")
                PillLabel("\(reservation.seats)-seat", systemImage: "chair.lounge.fill")
                if reservation.eventId != nil {
                    PillLabel("Event", systemImage: "ticket.fill")
                }
            }
            if canCancel {
                Button(role: .destructive) {
                    onCancel()
                } label: {
                    if isCancelling {
                        ProgressView()
                    } else {
                        Text("Cancel reservation")
                    }
                }
                .font(.subheadline)
                .disabled(isCancelling)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct StatusBadge: View {
    let status: ReservationStatus

    var body: some View {
        PillLabel(label, tint: tint)
    }

    private var label: String {
        switch status {
        case .no_show: return "No show"
        default: return status.rawValue.capitalized
        }
    }

    private var tint: Color {
        switch status {
        case .confirmed, .seated: return .green
        case .completed: return .blue
        case .cancelled, .no_show: return .red
        case .pending: return .orange
        }
    }
}
