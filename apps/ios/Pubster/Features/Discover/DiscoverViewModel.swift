import Foundation
import CoreLocation

@MainActor
final class DiscoverViewModel: ObservableObject {
    @Published var pubs: [PubSummaryDTO] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load(api: APIClient, coordinate: CLLocationCoordinate2D) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            // Wide radius so the seeded Boston pubs surface regardless of the
            // simulator's exact location; server returns them sorted by distance.
            let result = try await api.nearestPubs(
                lat: coordinate.latitude,
                lng: coordinate.longitude,
                radius: 50_000,
                limit: 50
            )
            pubs = result.sorted { $0.distanceMeters < $1.distanceMeters }
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}
