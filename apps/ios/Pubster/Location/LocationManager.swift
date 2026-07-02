import Foundation
import CoreLocation

/// Thin wrapper around `CLLocationManager` exposing authorization + the latest
/// coordinate to SwiftUI. Falls back to downtown Boston (where the seed pubs
/// live) when a real fix isn't available — keeps Discover useful in the
/// simulator.
@MainActor
final class LocationManager: NSObject, ObservableObject {
    static let fallbackCoordinate = CLLocationCoordinate2D(latitude: 42.3601, longitude: -71.0589)

    @Published private(set) var authorizationStatus: CLAuthorizationStatus
    @Published private(set) var lastCoordinate: CLLocationCoordinate2D?

    private let manager = CLLocationManager()

    override init() {
        authorizationStatus = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    /// The best coordinate we have, falling back to Boston.
    var effectiveCoordinate: CLLocationCoordinate2D {
        lastCoordinate ?? Self.fallbackCoordinate
    }

    var isAuthorized: Bool {
        authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways
    }

    func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }

    func startIfAuthorized() {
        if isAuthorized {
            manager.startUpdatingLocation()
        }
    }
}

extension LocationManager: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            self.authorizationStatus = status
            self.startIfAuthorized()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.last?.coordinate else { return }
        Task { @MainActor in
            self.lastCoordinate = coordinate
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Non-fatal: Discover falls back to the default coordinate.
    }
}
