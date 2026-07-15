import Foundation
import CoreLocation

@MainActor
final class DiscoverViewModel: ObservableObject {
    @Published var featuredEvents: [FeaturedEvent] = []
    @Published var pubs: [PubSummaryDTO] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    /// Pub ids that host an upcoming featured event (drives the accent chip).
    var pubIdsWithEvents: Set<String> {
        Set(featuredEvents.map { $0.pub.id })
    }

    /// First cut: serve curated mock data so the vibrant redesign can be
    /// reviewed without a running backend.
    ///
    /// TODO: real wiring — replace this with `loadFromAPI(...)` below (fetch the
    /// nearby pubs + their events, sort, and map into `FeaturedEvent`s) once the
    /// events feed is available. The published shape stays the same, so the
    /// views won't need to change.
    func loadMock() async {
        isLoading = true
        errorMessage = nil
        // Brief delay so the skeleton/shimmer loading state is exercised.
        try? await Task.sleep(nanoseconds: 550_000_000)
        featuredEvents = MockData.featuredEvents
        pubs = MockData.pubs
        isLoading = false
    }

    /// Real network path (kept intact for later wiring). Not called in this
    /// first cut, but preserved so nothing is lost when the backend is ready.
    func loadFromAPI(api: APIClient, coordinate: CLLocationCoordinate2D) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            // Wide radius so seeded pubs surface regardless of the simulator's
            // exact location; server returns them sorted by distance.
            let nearby = try await api.nearestPubs(
                lat: coordinate.latitude,
                lng: coordinate.longitude,
                radius: 50_000,
                limit: 50
            )
            let sortedPubs = nearby.sorted { $0.distanceMeters < $1.distanceMeters }
            pubs = sortedPubs

            // Build the featured-events carousel from the nearest pubs' upcoming events.
            var collected: [FeaturedEvent] = []
            for pub in sortedPubs.prefix(8) {
                guard let events = try? await api.events(pubId: pub.id) else { continue }
                for event in events {
                    collected.append(
                        FeaturedEvent(id: event.id, event: event, pub: pub, gradientIndex: 0)
                    )
                }
            }
            featuredEvents = collected
                .sorted { $0.event.startTime < $1.event.startTime }
                .enumerated()
                .map {
                    FeaturedEvent(
                        id: $0.element.id, event: $0.element.event,
                        pub: $0.element.pub, gradientIndex: $0.offset
                    )
                }
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}
