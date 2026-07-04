import SwiftUI

@main
struct PubsterApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var locationManager = LocationManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environmentObject(locationManager)
                .tint(.pubAccent)
        }
    }
}
