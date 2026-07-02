import SwiftUI
import MapKit

struct DiscoverView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var locationManager: LocationManager
    @StateObject private var vm = DiscoverViewModel()

    @State private var cameraPosition: MapCameraPosition = .automatic
    @State private var showBookings = false

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Nearby Pubs")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Menu {
                            if let name = appState.currentUser?.name, !name.isEmpty {
                                Text("Signed in as \(name)")
                            }
                            Button(role: .destructive) {
                                appState.signOut()
                            } label: {
                                Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                            }
                        } label: {
                            Image(systemName: "person.crop.circle")
                        }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showBookings = true
                        } label: {
                            Label("My bookings", systemImage: "calendar")
                        }
                    }
                }
                .sheet(isPresented: $showBookings) {
                    NavigationStack {
                        MyBookingsView()
                    }
                }
        }
        .task {
            locationManager.startIfAuthorized()
            await reload()
        }
    }

    @ViewBuilder
    private var content: some View {
        if vm.isLoading && vm.pubs.isEmpty {
            ProgressView("Finding pubs…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let error = vm.errorMessage, vm.pubs.isEmpty {
            ContentUnavailableView {
                Label("Couldn't load pubs", systemImage: "wifi.exclamationmark")
            } description: {
                Text(error)
            } actions: {
                Button("Try again") { Task { await reload() } }
                    .buttonStyle(.borderedProminent)
            }
        } else if vm.pubs.isEmpty {
            ContentUnavailableView(
                "No pubs nearby",
                systemImage: "mappin.slash",
                description: Text("We couldn't find any pubs around you right now.")
            )
        } else {
            list
        }
    }

    private var list: some View {
        List {
            Section {
                map
                    .frame(height: 220)
                    .listRowInsets(EdgeInsets())
            }
            Section("Sorted by distance") {
                ForEach(vm.pubs) { pub in
                    NavigationLink {
                        PubDetailView(pubId: pub.id, pubName: pub.name)
                    } label: {
                        PubRow(pub: pub)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await reload() }
    }

    private var map: some View {
        Map(position: $cameraPosition) {
            UserAnnotation()
            ForEach(vm.pubs) { pub in
                Marker(pub.name, systemImage: "mug.fill", coordinate:
                        CLLocationCoordinate2D(latitude: pub.latitude, longitude: pub.longitude))
                    .tint(Color.pubsterAccent)
            }
        }
        .mapControls {
            MapUserLocationButton()
        }
    }

    private func reload() async {
        await vm.load(api: appState.api, coordinate: locationManager.effectiveCoordinate)
        if let first = vm.pubs.first {
            let center = CLLocationCoordinate2D(latitude: first.latitude, longitude: first.longitude)
            cameraPosition = .region(
                MKCoordinateRegion(center: center, latitudinalMeters: 6_000, longitudinalMeters: 6_000)
            )
        }
    }
}

private struct PubRow: View {
    let pub: PubSummaryDTO

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.pubsterAccent.opacity(0.15))
                .frame(width: 46, height: 46)
                .overlay {
                    Image(systemName: "mug.fill")
                        .foregroundStyle(Color.pubsterAccent)
                }
            VStack(alignment: .leading, spacing: 3) {
                Text(pub.name)
                    .font(.headline)
                    .lineLimit(1)
                if !pub.shortAddress.isEmpty {
                    Text(pub.shortAddress)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            PillLabel(pub.distanceLabel, systemImage: "location.fill")
        }
        .padding(.vertical, 4)
    }
}
