import Foundation

@MainActor
final class ReserveViewModel: ObservableObject {
    @Published var date = Date()
    @Published var partyCount = 2
    @Published var slots: [AvailabilitySlotDTO] = []
    @Published var joinEventId: String?

    @Published var isLoadingSlots = false
    @Published var hasSearched = false
    @Published var isBooking = false
    @Published var errorMessage: String?
    @Published var confirmation: ReservationDTO?

    var availableSlots: [AvailabilitySlotDTO] {
        slots.filter(\.available)
    }

    func loadAvailability(api: APIClient, pubId: String) async {
        isLoadingSlots = true
        errorMessage = nil
        hasSearched = true
        defer { isLoadingSlots = false }
        do {
            slots = try await api.availability(
                pubId: pubId,
                date: DateUtils.apiDate(from: date),
                partyCount: partyCount
            )
        } catch {
            slots = []
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    /// Does `event` overlap the given slot window? (Matches the backend check.)
    func event(_ event: EventDTO, overlaps slot: AvailabilitySlotDTO) -> Bool {
        guard
            let eventStart = DateUtils.date(fromISO: event.startTime),
            let eventEnd = DateUtils.date(fromISO: event.endTime),
            let slotStart = DateUtils.date(fromISO: slot.startTime),
            let slotEnd = DateUtils.date(fromISO: slot.endTime)
        else { return false }
        return eventStart < slotEnd && eventEnd > slotStart
    }

    func book(api: APIClient, pubId: String, slot: AvailabilitySlotDTO, events: [EventDTO]) async {
        isBooking = true
        errorMessage = nil
        defer { isBooking = false }

        // Only attach the event if it actually overlaps the chosen slot.
        var eventId: String?
        if let selectedId = joinEventId,
           let event = events.first(where: { $0.id == selectedId }),
           self.event(event, overlaps: slot) {
            eventId = selectedId
        }

        do {
            confirmation = try await api.createReservation(
                CreateReservationBody(
                    pubId: pubId,
                    startTime: slot.startTime,
                    partyCount: partyCount,
                    eventId: eventId
                )
            )
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}
