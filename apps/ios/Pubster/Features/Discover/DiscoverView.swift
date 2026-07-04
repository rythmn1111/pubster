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
            ZStack {
                ScreenBackground()
                content
            }
            .navigationTitle("Pubster")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
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
            LoadingStateView(message: "Finding pubs near you…")
        } else if let error = vm.errorMessage, vm.pubs.isEmpty {
            EmptyStateView(
                icon: "wifi.exclamationmark",
                title: "Couldn't load pubs",
                message: error,
                actionTitle: "Try again",
                action: { Task { await reload() } }
            )
        } else if vm.pubs.isEmpty {
            EmptyStateView(
                icon: "mappin.slash",
                title: "No pubs nearby",
                message: "We couldn't find any pubs around you right now."
            )
        } else {
            list
        }
    }

    private var list: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                SectionHeader("Pubs near you", subtitle: "Sorted by distance")
                    .padding(.top, Spacing.xs)

                mapCard

                LazyVStack(spacing: Spacing.md) {
                    ForEach(vm.pubs) { pub in
                        NavigationLink {
                            PubDetailView(pubId: pub.id, pubName: pub.name)
                        } label: {
                            PubCard(pub: pub)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, Spacing.screen)
            .padding(.bottom, Spacing.xxl)
        }
        .refreshable { await reload() }
    }

    private var mapCard: some View {
        Map(position: $cameraPosition) {
            UserAnnotation()
            ForEach(vm.pubs) { pub in
                Marker(pub.name, systemImage: "mug.fill", coordinate:
                        CLLocationCoordinate2D(latitude: pub.latitude, longitude: pub.longitude))
                    .tint(Color.pubAccent)
            }
        }
        .mapControls {
            MapUserLocationButton()
        }
        .frame(height: 200)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .strokeBorder(Color.pubBorder, lineWidth: 1)
        )
        .softShadow()
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

private struct PubCard: View {
    let pub: PubSummaryDTO

    var body: some View {
        Card {
            HStack(spacing: Spacing.md) {
                PubThumbnail(size: 60)
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text(pub.name)
                        .font(.pubHeadline)
                        .foregroundStyle(Color.pubEspresso)
                        .lineLimit(1)
                    if !pub.shortAddress.isEmpty {
                        Text(pub.shortAddress)
                            .font(.pubBody)
                            .foregroundStyle(Color.pubTextSecondary)
                            .lineLimit(1)
                    }
                    PillLabel(pub.distanceLabel, systemImage: "mappin")
                        .padding(.top, 2)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.pubTextSecondary.opacity(0.6))
            }
        }
    }
}
