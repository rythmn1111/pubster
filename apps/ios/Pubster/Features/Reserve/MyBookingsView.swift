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
        ZStack {
            ScreenBackground()
            content
        }
        .navigationTitle("My Bookings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { dismiss() }
            }
        }
        .task { await vm.load(api: appState.api) }
    }

    @ViewBuilder
    private var content: some View {
        if vm.isLoading && vm.reservations.isEmpty {
            LoadingStateView(message: "Loading your bookings…")
        } else if let error = vm.errorMessage, vm.reservations.isEmpty {
            EmptyStateView(
                icon: "calendar.badge.exclamationmark",
                title: "Couldn't load bookings",
                message: error,
                actionTitle: "Try again",
                action: { Task { await vm.load(api: appState.api) } }
            )
        } else if vm.reservations.isEmpty {
            EmptyStateView(
                icon: "calendar",
                title: "No bookings yet",
                message: "Reserve a table and it'll show up here."
            )
        } else {
            list
        }
    }

    private var list: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                if !vm.upcoming.isEmpty {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        SectionHeader("Upcoming")
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
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        SectionHeader("Past & cancelled")
                        ForEach(vm.past) { reservation in
                            BookingRow(reservation: reservation, isCancelling: false, canCancel: false, onCancel: {})
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.screen)
            .padding(.top, Spacing.md)
            .padding(.bottom, Spacing.xxl)
        }
        .refreshable { await vm.load(api: appState.api) }
    }
}

private struct BookingRow: View {
    let reservation: ReservationDTO
    let isCancelling: Bool
    let canCancel: Bool
    let onCancel: () -> Void

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack(alignment: .top) {
                    HStack(spacing: Spacing.md) {
                        PubThumbnail(size: 44)
                        Text(reservation.pubName ?? "Pub")
                            .font(.pubHeadline)
                            .foregroundStyle(Color.pubEspresso)
                    }
                    Spacer(minLength: Spacing.sm)
                    StatusBadge(status: reservation.status)
                }
                Label(DateUtils.dateTimeLabel(fromISO: reservation.startTime), systemImage: "calendar")
                    .font(.pubBody)
                    .foregroundStyle(Color.pubTextSecondary)
                HStack(spacing: Spacing.sm) {
                    PillLabel("Party of \(reservation.partyCount)", systemImage: "person.2.fill")
                    PillLabel("\(reservation.seats)-seat", systemImage: "chair.lounge.fill")
                    if reservation.eventId != nil {
                        PillLabel("Event", systemImage: "ticket.fill", tint: .pubGold)
                    }
                }
                if canCancel {
                    Divider().overlay(Color.pubBorder)
                    TextButton(isCancelling ? "Cancelling…" : "Cancel reservation",
                               systemImage: "xmark.circle",
                               role: .destructive) {
                        onCancel()
                    }
                    .disabled(isCancelling)
                }
            }
        }
    }
}

private struct StatusBadge: View {
    let status: ReservationStatus

    var body: some View {
        PillLabel(label, systemImage: icon, tint: tint)
    }

    private var label: String {
        switch status {
        case .no_show: return "No show"
        default: return status.rawValue.capitalized
        }
    }

    private var icon: String {
        switch status {
        case .confirmed, .seated: return "checkmark.seal.fill"
        case .completed: return "flag.checkered"
        case .cancelled, .no_show: return "xmark.circle.fill"
        case .pending: return "clock.fill"
        }
    }

    private var tint: Color {
        switch status {
        case .confirmed, .seated: return .pubSuccess
        case .completed: return .pubAccent
        case .cancelled, .no_show: return .pubError
        case .pending: return .pubGold
        }
    }
}
