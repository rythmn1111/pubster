import SwiftUI

struct DiscoverView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var vm = DiscoverViewModel()

    @State private var path = NavigationPath()
    @State private var carouselIndex = 0
    @State private var showBookings = false
    @State private var didAutoOpenDetail = false

    // Auto-advance timer for the top carousel (~every 4s).
    private let advanceTimer = Timer.publish(
        every: Theme.carouselAdvance, on: .main, in: .common
    ).autoconnect()

    /// Hidden debug launch arg used only for screenshot capture — deep-links
    /// into the first Event Detail on launch. No effect on normal launches.
    private var autoOpenEventDetail: Bool {
        ProcessInfo.processInfo.arguments.contains("-openEventDetail")
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Theme.bg.ignoresSafeArea()
                content
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarItems }
            .navigationDestination(for: DiscoverRoute.self) { route in
                switch route {
                case .event(let id):
                    if let featured = vm.featuredEvents.first(where: { $0.id == id }) {
                        EventDetailView(featured: featured)
                    }
                case .pub(let id, let name):
                    PubDetailView(pubId: id, pubName: name)
                }
            }
            .sheet(isPresented: $showBookings) {
                NavigationStack { MyBookingsView() }
            }
        }
        .task {
            if vm.featuredEvents.isEmpty { await vm.loadMock() }
            if autoOpenEventDetail, !didAutoOpenDetail, let first = vm.featuredEvents.first {
                didAutoOpenDetail = true
                path.append(DiscoverRoute.event(first.id))
            }
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                header
                if vm.isLoading && vm.featuredEvents.isEmpty {
                    loadingState
                } else {
                    carouselSection
                    pubsSection
                }
            }
            .padding(.bottom, 32)
        }
        .scrollIndicators(.hidden)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Tonight near you")
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Theme.accent)
            Text("Discover")
                .font(.system(size: 36, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 8)
    }

    // MARK: - Carousel

    private var carouselSection: some View {
        VStack(spacing: 14) {
            TabView(selection: $carouselIndex) {
                ForEach(Array(vm.featuredEvents.enumerated()), id: \.element.id) { index, featured in
                    GeometryReader { geo in
                        NavigationLink(value: DiscoverRoute.event(featured.id)) {
                            EventSlide(featured: featured)
                                .scaleEffect(scale(for: geo))
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 4)
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 268)
            .onReceive(advanceTimer) { _ in
                guard vm.featuredEvents.count > 1 else { return }
                withAnimation(.easeInOut(duration: 0.6)) {
                    carouselIndex = (carouselIndex + 1) % vm.featuredEvents.count
                }
            }

            PageDots(count: vm.featuredEvents.count, index: carouselIndex)
        }
    }

    /// Subtle parallax: slides shrink slightly as they move off-center.
    private func scale(for geo: GeometryProxy) -> CGFloat {
        let screenWidth = UIScreen.main.bounds.width
        let distance = abs(geo.frame(in: .global).midX - screenWidth / 2)
        return max(0.9, 1 - distance / screenWidth * 0.16)
    }

    // MARK: - Pubs

    private var pubsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader("Pubs near you", subtitle: "Sorted by distance", systemImage: "map.fill")
                .padding(.horizontal, 20)

            VStack(spacing: 12) {
                ForEach(Array(vm.pubs.enumerated()), id: \.element.id) { index, pub in
                    NavigationLink(value: DiscoverRoute.pub(id: pub.id, name: pub.name)) {
                        PubCard(
                            pub: pub,
                            gradientIndex: index,
                            hasEvent: vm.pubIdsWithEvents.contains(pub.id)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)

            if vm.pubs.isEmpty && !vm.isLoading {
                emptyState
            }
        }
    }

    // MARK: - Loading & empty states

    private var loadingState: some View {
        VStack(alignment: .leading, spacing: 26) {
            SkeletonBlock(cornerRadius: 26)
                .frame(height: 260)
                .padding(.horizontal, 20)
            VStack(spacing: 12) {
                ForEach(0..<3, id: \.self) { _ in
                    HStack(spacing: 14) {
                        SkeletonBlock(cornerRadius: 16).frame(width: 58, height: 58)
                        VStack(alignment: .leading, spacing: 8) {
                            SkeletonBlock(cornerRadius: 6).frame(width: 160, height: 14)
                            SkeletonBlock(cornerRadius: 6).frame(width: 110, height: 12)
                        }
                        Spacer()
                    }
                    .padding(14)
                    .cardStyle(cornerRadius: 20)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private var emptyState: some View {
        ContentUnavailableView(
            "No pubs nearby",
            systemImage: "mappin.slash",
            description: Text("We couldn't find any pubs around you right now.")
        )
        .padding(.top, 20)
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarItems: some ToolbarContent {
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
                    .font(.title3)
            }
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                showBookings = true
            } label: {
                Image(systemName: "calendar")
                    .font(.title3)
            }
        }
    }
}
